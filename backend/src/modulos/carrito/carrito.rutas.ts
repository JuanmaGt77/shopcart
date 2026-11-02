import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import { SOLO_CLIENTE } from '../../compartido/http/tipos.js';
import { agregarEsquema, cantidadEsquema, cuponEsquema, fusionarEsquema, varianteEnRuta } from './carrito.esquemas.js';
import { carritoServicio, duenioDelCarrito } from './carrito.servicio.js';

const encabezadoInvitado = {
  'X-Carrito-Token': {
    descripcion: 'Solo para invitados (sin sesión): el token que devolvió el primer POST /api/carrito/items.',
    requerido: false,
  },
};

export function rutasCarrito(): Modulo {
  return new Modulo('/api/carrito', 'Carrito')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Ver el carrito con subtotal, descuento y total',
      descripcion:
        'Con token: el carrito del cliente. Sin token: el carrito de invitado indicado en X-Carrito-Token. Los montos se calculan en SQL Server con DECIMAL, sin errores de redondeo.',
      acceso: 'opcional',
      encabezados: encabezadoInvitado,
      manejador: async ({ usuario, req }) => respuesta(await carritoServicio.obtener(duenioDelCarrito(usuario, req))),
    })
    .ruta({
      metodo: 'post',
      ruta: '/items',
      resumen: 'Agregar un producto al carrito',
      descripcion:
        'No permite tener más unidades que las disponibles. Si es un invitado sin carrito, se crea uno y la respuesta trae el tokenInvitado.',
      acceso: 'opcional',
      encabezados: encabezadoInvitado,
      body: agregarEsquema,
      manejador: async ({ usuario, req, body }) =>
        respuesta(await carritoServicio.agregar(duenioDelCarrito(usuario, req), body.idVariante, body.cantidad)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/items/:idVariante',
      resumen: 'Cambiar la cantidad de un producto del carrito',
      acceso: 'opcional',
      encabezados: encabezadoInvitado,
      params: varianteEnRuta,
      body: cantidadEsquema,
      manejador: async ({ usuario, req, params, body }) =>
        respuesta(
          await carritoServicio.actualizarCantidad(duenioDelCarrito(usuario, req), params.idVariante, body.cantidad),
        ),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/items/:idVariante',
      resumen: 'Quitar un producto del carrito',
      acceso: 'opcional',
      encabezados: encabezadoInvitado,
      params: varianteEnRuta,
      manejador: async ({ usuario, req, params }) =>
        respuesta(await carritoServicio.quitar(duenioDelCarrito(usuario, req), params.idVariante)),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/',
      resumen: 'Vaciar el carrito',
      acceso: 'opcional',
      encabezados: encabezadoInvitado,
      manejador: async ({ usuario, req }) => respuesta(await carritoServicio.vaciar(duenioDelCarrito(usuario, req))),
    })
    .ruta({
      metodo: 'post',
      ruta: '/cupon',
      resumen: 'Aplicar un cupón al carrito',
      descripcion:
        'Requiere sesión. Si el cupón no aplica responde con el motivo exacto: vencido, agotado, compra mínima no alcanzada, límite por cliente, etc.',
      acceso: SOLO_CLIENTE,
      body: cuponEsquema,
      manejador: async (ctx) => respuesta(await carritoServicio.aplicarCupon(usuarioDe(ctx).id, ctx.body.codigo)),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/cupon',
      resumen: 'Quitar el cupón del carrito',
      acceso: SOLO_CLIENTE,
      manejador: async (ctx) => respuesta(await carritoServicio.quitarCupon(usuarioDe(ctx).id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/fusionar',
      resumen: 'Pasar el carrito de invitado al carrito del cliente',
      descripcion: 'Se llama justo después del login. Si al sumar se pasa de lo disponible, se ajusta a lo disponible.',
      acceso: SOLO_CLIENTE,
      body: fusionarEsquema,
      manejador: async (ctx) =>
        respuesta(await carritoServicio.fusionar(usuarioDe(ctx).id, ctx.body.tokenInvitado)),
    });
}
