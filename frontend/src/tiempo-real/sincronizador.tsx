/**
 * Traduce cada evento del WebSocket a la consulta que hay que refrescar. Es el único lugar donde
 * el frontend reacciona al tiempo real: las pantallas solo leen sus consultas y se actualizan solas.
 *
 *   inventario:existencia  -> disponibles en catálogo, detalle, carrito e inventario
 *   catalogo:actualizado   -> catálogo, detalle y categorías
 *   pedido:creado          -> listas de pedidos (+ aviso al personal)
 *   pedido:estado          -> el pedido y las listas (+ aviso al cliente)
 *   dashboard:actualizar   -> reportes del dashboard
 *   carrito:actualizado    -> el carrito (otra pestaña o dispositivo del mismo cliente)
 *   checkout:expirado      -> el checkout y el carrito (+ aviso)
 *   sesion:revocada        -> cierra la sesión
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
import { almacenSesion } from '@/modulos/auth/almacen-sesion';
import { esPersonal } from '@/modulos/auth/tipos';
import { NOMBRE_ESTADO_PEDIDO, type CodigoEstadoPedido } from '@/modulos/pedidos/estados';
import { iniciarTiempoReal, socket } from './socket';

interface ExistenciaVariante {
  idVariante: number;
  idProducto?: number;
  disponible: number;
}

interface PedidoCreado {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  cliente?: string;
  total: number;
}

interface CambioEstado {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  estadoNuevo: CodigoEstadoPedido;
}

interface ProductoConVariantes {
  variantes?: { idVariante: number; disponible: number }[];
}

/** Actualiza al instante lo disponible de las variantes en los detalles de producto ya cargados. */
function parcharDisponibles(cliente: QueryClient, variantes: ExistenciaVariante[]) {
  const porId = new Map(variantes.map((v) => [v.idVariante, v.disponible]));
  cliente.setQueriesData<ProductoConVariantes>({ queryKey: [PREFIJO.producto] }, (anterior) => {
    if (!anterior?.variantes?.some((v) => porId.has(v.idVariante))) return anterior;
    return {
      ...anterior,
      variantes: anterior.variantes.map((v) =>
        porId.has(v.idVariante) ? { ...v, disponible: porId.get(v.idVariante) ?? v.disponible } : v,
      ),
    };
  });
}

/** Escucha un evento del servidor y devuelve la función para dejar de escucharlo. */
function escuchar<T = unknown>(evento: string, manejador: (datos: T) => void): () => void {
  const envoltura = (datos: T) => manejador(datos);
  socket.on(evento, envoltura);
  return () => {
    socket.off(evento, envoltura);
  };
}

export function SincronizadorTiempoReal() {
  const cliente = useQueryClient();

  useEffect(() => {
    const invalidar = (...prefijos: string[]) => {
      for (const prefijo of prefijos) void cliente.invalidateQueries({ queryKey: [prefijo] });
    };

    const suscripciones = [
      escuchar<{ variantes: ExistenciaVariante[] }>('inventario:existencia', ({ variantes }) => {
        parcharDisponibles(cliente, variantes);
        invalidar(PREFIJO.productos, PREFIJO.carrito, PREFIJO.inventario);
      }),
      escuchar('catalogo:actualizado', () =>
        invalidar(PREFIJO.productos, PREFIJO.producto, PREFIJO.categorias),
      ),
      escuchar<PedidoCreado>('pedido:creado', (pedido) => {
        invalidar(PREFIJO.pedidos);
        if (esPersonal(almacenSesion.obtener().usuario?.rol)) {
          toast.info(`Nuevo pedido ${pedido.numeroPedido}`, { description: pedido.cliente });
        }
      }),
      escuchar<CambioEstado>('pedido:estado', (cambio) => {
        invalidar(PREFIJO.pedidos, PREFIJO.pedido);
        const usuario = almacenSesion.obtener().usuario;
        if (usuario?.rol === 'CLIENTE' && usuario.idUsuario === cambio.idUsuario) {
          toast.info(
            `Tu pedido ${cambio.numeroPedido} ahora está: ${NOMBRE_ESTADO_PEDIDO[cambio.estadoNuevo]}`,
          );
        }
      }),
      escuchar('dashboard:actualizar', () => invalidar(PREFIJO.reportes)),
      escuchar('carrito:actualizado', () => invalidar(PREFIJO.carrito)),
      escuchar('checkout:expirado', () => {
        invalidar(PREFIJO.checkout, PREFIJO.carrito);
        toast.warning('Tu reserva de 15 minutos venció', {
          description: 'Liberamos las unidades. Puedes volver a iniciar el pago desde tu carrito.',
        });
      }),
      escuchar('sesion:revocada', () => almacenSesion.limpiar('revocada')),
    ];

    const detener = iniciarTiempoReal();
    return () => {
      for (const cancelar of suscripciones) cancelar();
      detener();
    };
  }, [cliente]);

  return null;
}
