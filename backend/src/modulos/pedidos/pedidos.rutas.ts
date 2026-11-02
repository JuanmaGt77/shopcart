import { idEnRuta } from '../../compartido/esquemas.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { CUALQUIER_ROL, PERSONAL, SOLO_CLIENTE } from '../../compartido/http/tipos.js';
import {
  cambiarEstadoEsquema,
  cancelarEsquema,
  devolucionEsquema,
  listarPedidosEsquema,
  misPedidosEsquema,
} from './pedidos.esquemas.js';
import { pedidosServicio } from './pedidos.servicio.js';

export function rutasPedidos(): Modulo {
  return (
    new Modulo('/api/pedidos', 'Pedidos')
      // "/mios" va antes de "/:id" para que Express no lo tome como un ID
      .ruta({
        metodo: 'get',
        ruta: '/mios',
        resumen: 'Mis pedidos',
        acceso: SOLO_CLIENTE,
        query: misPedidosEsquema,
        manejador: async (ctx) => respuestaPaginada(await pedidosServicio.misPedidos(usuarioDe(ctx).id, ctx.query)),
      })
      .ruta({
        metodo: 'get',
        ruta: '/',
        resumen: 'Listado de pedidos para el personal',
        descripcion:
          'Filtros por estado, cliente (nombre, correo o número de pedido) y rango de fechas (días de Guatemala). Paginación y orden del lado del servidor.',
        acceso: PERSONAL,
        query: listarPedidosEsquema,
        manejador: async ({ query }) => respuestaPaginada(await pedidosServicio.listar(query)),
      })
      .ruta({
        metodo: 'get',
        ruta: '/:id',
        resumen: 'Detalle del pedido con líneas, historial de estados, pago y devoluciones',
        descripcion: 'Un cliente solo puede ver sus propios pedidos: si cambia el ID por el de otro cliente recibe 403.',
        acceso: CUALQUIER_ROL,
        params: idEnRuta,
        manejador: async (ctx) => respuesta(await pedidosServicio.obtener(ctx.params.id, usuarioDe(ctx))),
      })
      .ruta({
        metodo: 'patch',
        ruta: '/:id/estado',
        resumen: 'Avanzar el pedido (preparación, despacho, entrega)',
        descripcion:
          'Una transición no permitida (por ejemplo PAGADO -> ENTREGADO) se rechaza con 409 en la API y también en la base. Cada cambio guarda usuario, fecha, estado anterior y nuevo.',
        acceso: PERSONAL,
        params: idEnRuta,
        body: cambiarEstadoEsquema,
        manejador: async (ctx) =>
          respuesta(
            await pedidosServicio.cambiarEstado(usuarioDe(ctx), ctx.params.id, ctx.body.estado, ctx.body.comentario),
          ),
      })
      .ruta({
        metodo: 'post',
        ruta: '/:id/cancelar',
        resumen: 'Cancelar un pedido que todavía no se despachó',
        descripcion:
          'El cliente solo puede cancelar los suyos. Reintegra la existencia con movimientos de kardex, libera el uso del cupón y reembolsa el pago.',
        acceso: CUALQUIER_ROL,
        params: idEnRuta,
        body: cancelarEsquema,
        manejador: async (ctx) =>
          respuesta(await pedidosServicio.cancelar(usuarioDe(ctx), ctx.params.id, ctx.body.motivo)),
      })
      .ruta({
        metodo: 'post',
        ruta: '/:id/devoluciones',
        resumen: 'Registrar una devolución total o parcial',
        descripcion:
          'Por línea del pedido. No permite devolver más de lo vendido. Reintegra la existencia por kardex y reembolsa la parte proporcional (si se devuelve todo, también el envío).',
        acceso: PERSONAL,
        params: idEnRuta,
        body: devolucionEsquema,
        estado: 201,
        manejador: async (ctx) =>
          respuesta(await pedidosServicio.registrarDevolucion(usuarioDe(ctx), ctx.params.id, ctx.body)),
      })
      .ruta({
        metodo: 'get',
        ruta: '/:id/devoluciones',
        resumen: 'Devoluciones de un pedido',
        acceso: PERSONAL,
        params: idEnRuta,
        manejador: async ({ params }) => respuesta(await pedidosServicio.devoluciones(params.id)),
      })
  );
}
