import { idEnRuta } from '../../compartido/esquemas.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import { SOLO_CLIENTE } from '../../compartido/http/tipos.js';
import { claveIdempotencia, iniciarCheckoutEsquema, pagarEsquema } from './checkout.esquemas.js';
import { checkoutServicio } from './checkout.servicio.js';

export function rutasCheckout(): Modulo {
  return new Modulo('/api/checkout', 'Checkout y pago')
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Iniciar el pago: congela precios y reserva la existencia por 15 minutos',
      descripcion:
        'Valida que la dirección sea del cliente, que todo siga a la venta y el cupón (si hay). Si una sola línea no tiene existencia suficiente, no se reserva nada (409 STOCK_INSUFICIENTE). Si dos clientes van por la última unidad al mismo tiempo, solo uno la consigue.',
      acceso: SOLO_CLIENTE,
      body: iniciarCheckoutEsquema,
      estado: 201,
      manejador: async (ctx) =>
        respuesta(await checkoutServicio.iniciar(usuarioDe(ctx), ctx.body.idDireccion, ctx.body.idMetodoEnvio)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Ver un checkout (resumen y segundos que le quedan a la reserva)',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await checkoutServicio.obtener(usuarioDe(ctx), ctx.params.id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/:id/pagar',
      resumen: 'Pagar y crear el pedido (idempotente)',
      descripcion:
        'Requiere el encabezado Idempotency-Key (un UUID por intento de pago). Si la misma solicitud llega dos veces (doble clic o reintento por falla de red) se devuelve el mismo pedido con 200 y duplicado=true: nunca hay dos pedidos ni dos cobros. Tarjetas de prueba: 4111111111111111 aprobada, 4000000000000002 rechazada, 4000000000009995 sin fondos.',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      body: pagarEsquema,
      encabezados: {
        'Idempotency-Key': { descripcion: 'Identificador único del intento de pago (por ejemplo un UUID).', requerido: true },
      },
      estado: 201,
      manejador: async (ctx) => {
        const clave = claveIdempotencia.parse(ctx.req.get('idempotency-key'));
        const resultado = await checkoutServicio.pagar(usuarioDe(ctx), ctx.params.id, clave, ctx.body.tarjeta);
        if (resultado.duplicado) ctx.res.locals['estado'] = 200;
        return respuesta(resultado);
      },
    })
    .ruta({
      metodo: 'delete',
      ruta: '/:id',
      resumen: 'Cancelar el checkout y liberar la reserva',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await checkoutServicio.cancelar(usuarioDe(ctx), ctx.params.id)),
    });
}
