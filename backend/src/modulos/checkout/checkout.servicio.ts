import { ErrorAplicacion, ErrorConflicto, ErrorNoEncontrado } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import type { UsuarioAutenticado } from '../../compartido/http/tipos.js';
import { pedidosRepositorio, type PedidoDetalle } from '../pedidos/pedidos.repositorio.js';
import { checkoutRepositorio, type Checkout } from './checkout.repositorio.js';
import { cobrar, type DatosTarjeta } from './pasarela-pago.js';

function existente(checkout: Checkout | null): Checkout {
  if (!checkout) throw new ErrorNoEncontrado('El checkout no existe.', 'CHECKOUT_NO_ENCONTRADO');
  return checkout;
}

function avisarReserva(checkout: Checkout) {
  eventosDominio.emit(
    'inventario:cambio',
    checkout.lineas.map((l) => ({ idVariante: Number(l.idVariante), sku: String(l.sku), disponible: Number(l.disponible ?? 0) })),
  );
}

async function pedidoDe(idPedido: number, usuario: UsuarioAutenticado): Promise<PedidoDetalle> {
  const pedido = await pedidosRepositorio.obtener(idPedido, usuario.id, false);
  if (!pedido) throw new ErrorNoEncontrado('El pedido no existe.', 'PEDIDO_NO_ENCONTRADO');
  return pedido;
}

export interface ResultadoPago {
  pedido: PedidoDetalle;
  /** true cuando fue un reintento (doble clic o falla de red) y se devolvió el pedido que ya existía */
  duplicado: boolean;
}

export const checkoutServicio = {
  /** Congela precios y descuento, y aparta la existencia por 15 minutos. */
  async iniciar(usuario: UsuarioAutenticado, idDireccion: number, idMetodoEnvio: number) {
    const checkout = existente(await checkoutRepositorio.iniciar(usuario.id, idDireccion, idMetodoEnvio));
    avisarReserva(checkout);
    return checkout;
  },

  async obtener(usuario: UsuarioAutenticado, idCheckout: number) {
    return existente(await checkoutRepositorio.obtener(usuario.id, idCheckout));
  },

  async cancelar(usuario: UsuarioAutenticado, idCheckout: number) {
    const checkout = existente(await checkoutRepositorio.cancelar(usuario.id, idCheckout));
    avisarReserva(checkout);
    return checkout;
  },

  /**
   * Paga el checkout y crea el pedido.
   * 1. Si la misma Idempotency-Key ya generó un pedido, lo devuelve sin cobrar otra vez.
   * 2. Revisa que el checkout sea del cliente y siga activo (si ya se pagó con otra
   *    clave, también devuelve ese pedido).
   * 3. Cobra en la pasarela simulada.
   * 4. Crea el pedido en UNA transacción (SP_Pedidos_CrearPedido). Si dos solicitudes
   *    llegan al mismo tiempo, la base deja pasar solo una y a la otra le devuelve el
   *    mismo pedido.
   */
  async pagar(
    usuario: UsuarioAutenticado,
    idCheckout: number,
    claveIdempotencia: string,
    tarjeta: DatosTarjeta,
  ): Promise<ResultadoPago> {
    const previo = await pedidosRepositorio.porIdempotencia(usuario.id, claveIdempotencia);
    if (previo) {
      if (previo.idCheckout !== idCheckout) {
        throw new ErrorConflicto('Esa clave de idempotencia ya se usó para otro pago.', 'IDEMPOTENCIA_CONFLICTO');
      }
      return { pedido: await pedidoDe(previo.idPedido, usuario), duplicado: true };
    }

    const checkout = existente(await checkoutRepositorio.obtener(usuario.id, idCheckout));
    if (checkout.estado === 'COMPLETADO' && checkout.idPedido) {
      return { pedido: await pedidoDe(checkout.idPedido, usuario), duplicado: true };
    }
    if (checkout.estado === 'EXPIRADO' || (checkout.estado === 'ACTIVO' && checkout.segundosRestantes <= 0)) {
      throw new ErrorConflicto(
        'Tu reserva de 15 minutos expiró y las unidades se liberaron. Vuelve a iniciar el pago.',
        'RESERVA_EXPIRADA',
      );
    }
    if (checkout.estado !== 'ACTIVO') {
      throw new ErrorConflicto('Este checkout ya no está activo. Vuelve a iniciar el pago.', 'CHECKOUT_NO_ACTIVO');
    }

    const cobro = cobrar(tarjeta, claveIdempotencia);
    if (!cobro.aprobado) throw new ErrorAplicacion(402, 'PAGO_RECHAZADO', cobro.motivo);

    const creado = await pedidosRepositorio.crearPedido({
      idUsuario: usuario.id,
      idCheckout,
      claveIdempotencia,
      codigoAutorizacion: cobro.codigoAutorizacion,
      marca: cobro.marca,
      ultimosDigitos: cobro.ultimosDigitos,
    });
    if (!creado?.idPedido) throw new ErrorAplicacion(500, 'ERROR_INTERNO', 'No se pudo crear el pedido.');

    const pedido = await pedidoDe(creado.idPedido, usuario);
    if (!creado.esDuplicado) {
      eventosDominio.emit('pedido:creado', {
        idPedido: pedido.idPedido,
        numeroPedido: pedido.numeroPedido,
        idUsuario: pedido.idUsuario,
        cliente: pedido.cliente,
        total: pedido.total,
      });
      eventosDominio.emit('ventas:cambiaron', { motivo: `nuevo pedido ${pedido.numeroPedido}` });
      eventosDominio.emit(
        'inventario:cambio',
        pedido.lineas.map((l) => ({ idVariante: Number(l.idVariante), sku: String(l.sku), disponible: Number(l.disponibleActual) })),
      );
    }
    return { pedido, duplicado: creado.esDuplicado };
  },
};
