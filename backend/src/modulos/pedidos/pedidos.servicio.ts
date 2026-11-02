import { ErrorAplicacion, ErrorNoEncontrado } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import type { UsuarioAutenticado } from '../../compartido/http/tipos.js';
import { validarTransicion, type EstadoPedido } from './maquina-estados.js';
import { pedidosRepositorio, type PedidoDetalle } from './pedidos.repositorio.js';
import type { DatosDevolucion, FiltroMisPedidos, FiltroPedidos } from './pedidos.esquemas.js';

const esPersonal = (usuario: UsuarioAutenticado) => usuario.rol === 'ADMIN' || usuario.rol === 'OPERADOR';

function existente(pedido: PedidoDetalle | null): PedidoDetalle {
  if (!pedido) throw new ErrorNoEncontrado('El pedido no existe.', 'PEDIDO_NO_ENCONTRADO');
  return pedido;
}

/** Avisos en tiempo real después de que la base confirmó el cambio. */
function avisarCambio(pedido: PedidoDetalle, estadoAnterior: string | null, movioInventario: boolean) {
  if (estadoAnterior !== pedido.estadoCodigo) {
    eventosDominio.emit('pedido:estado', {
      idPedido: pedido.idPedido,
      numeroPedido: pedido.numeroPedido,
      idUsuario: pedido.idUsuario,
      estadoAnterior,
      estadoNuevo: pedido.estadoCodigo,
    });
  }
  eventosDominio.emit('ventas:cambiaron', { motivo: `pedido ${pedido.numeroPedido}: ${pedido.estadoCodigo}` });
  if (movioInventario) {
    eventosDominio.emit(
      'inventario:cambio',
      pedido.lineas.map((l) => ({
        idVariante: Number(l.idVariante),
        sku: String(l.sku),
        disponible: Number(l.disponibleActual),
      })),
    );
  }
}

export const pedidosServicio = {
  /** Un cliente solo puede ver sus pedidos: si pide uno ajeno el SP responde 403. */
  async obtener(idPedido: number, usuario: UsuarioAutenticado) {
    return existente(await pedidosRepositorio.obtener(idPedido, usuario.id, esPersonal(usuario)));
  },

  misPedidos: (idUsuario: number, filtro: FiltroMisPedidos) => pedidosRepositorio.misPedidos(idUsuario, filtro),

  listar: (filtro: FiltroPedidos) => pedidosRepositorio.listar(filtro),

  /** Preparación, despacho y entrega. Se valida aquí y otra vez en la base. */
  async cambiarEstado(usuario: UsuarioAutenticado, idPedido: number, estado: EstadoPedido, comentario?: string | null) {
    const actual = await this.obtener(idPedido, usuario);
    validarTransicion(actual.estadoCodigo, estado, usuario.rol);

    const pedido = existente(await pedidosRepositorio.cambiarEstado(usuario.id, idPedido, estado, comentario));
    avisarCambio(pedido, actual.estadoCodigo, false);
    return pedido;
  },

  /** Cancelación antes del despacho: reintegra inventario, libera el cupón y reembolsa. */
  async cancelar(usuario: UsuarioAutenticado, idPedido: number, motivo: string) {
    const actual = await this.obtener(idPedido, usuario);
    validarTransicion(actual.estadoCodigo, 'CANCELADO', usuario.rol);

    const pedido = existente(await pedidosRepositorio.cancelar(usuario.id, idPedido, motivo, usuario.rol === 'CLIENTE'));
    avisarCambio(pedido, actual.estadoCodigo, true);
    return pedido;
  },

  /** Devolución total o parcial por línea. Las cantidades se validan aquí y en la base. */
  async registrarDevolucion(usuario: UsuarioAutenticado, idPedido: number, datos: DatosDevolucion) {
    const actual = await this.obtener(idPedido, usuario);

    if (actual.estadoCodigo !== 'ENTREGADO' && actual.estadoCodigo !== 'DEVUELTO_PARCIAL') {
      throw new ErrorAplicacion(
        409,
        'PEDIDO_NO_DEVOLVIBLE',
        `Solo se pueden devolver productos de pedidos entregados. Este pedido está "${String(actual.estado)}".`,
      );
    }

    for (const linea of datos.lineas) {
      const vendida = actual.lineas.find((l) => Number(l.idPedidoDetalle) === linea.idPedidoDetalle);
      if (!vendida) {
        throw new ErrorAplicacion(400, 'LINEA_NO_PERTENECE_AL_PEDIDO', 'Alguna de las líneas indicadas no pertenece a este pedido.');
      }
      const devolvible = Number(vendida.cantidadDevolvible);
      if (linea.cantidad > devolvible) {
        throw new ErrorAplicacion(
          409,
          'DEVOLUCION_EXCEDE_VENDIDO',
          `No se puede devolver más de lo vendido: de ${String(vendida.sku)} se pueden devolver como máximo ${devolvible} unidades.`,
        );
      }
    }

    const devolucion = await pedidosRepositorio.registrarDevolucion(usuario.id, idPedido, datos);
    const pedido = existente(await pedidosRepositorio.obtener(idPedido, usuario.id, true));
    avisarCambio(pedido, actual.estadoCodigo, true);
    return { devolucion, pedido };
  },

  devoluciones: (idPedido: number) => pedidosRepositorio.devoluciones(idPedido),
};
