import { z } from 'zod';
import { idEnRuta } from '../../compartido/esquemas.js';
import { ErrorNoEncontrado } from '../../compartido/errores.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { SOLO_ADMIN } from '../../compartido/http/tipos.js';
import { actualizarCuponEsquema, crearCuponEsquema, listarCuponesEsquema, usosEsquema } from './cupones.esquemas.js';
import { cuponesRepositorio } from './cupones.repositorio.js';

/**
 * El CRUD de cupones no tiene reglas propias en la API: las validaciones de forma
 * las hace Zod y las de negocio (código duplicado, límite menor a los usos, etc.)
 * el SP. Por eso aquí la capa HTTP llama directo al repositorio.
 * Las reglas al USAR un cupón están en FU_Cupones_EvaluarCarrito y SP_Pedidos_CrearPedido.
 */
function existente<T>(valor: T | null): T {
  if (!valor) throw new ErrorNoEncontrado('El cupón no existe.', 'CUPON_NO_EXISTE');
  return valor;
}

export function rutasCupones(): Modulo {
  return new Modulo('/api/cupones', 'Cupones')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Listar cupones (filtro por estado: vigente, programado, vencido, agotado, inactivo)',
      acceso: SOLO_ADMIN,
      query: listarCuponesEsquema,
      manejador: async ({ query }) => respuestaPaginada(await cuponesRepositorio.listar(query)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Ver un cupón',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      manejador: async ({ params }) => respuesta(existente(await cuponesRepositorio.obtener(params.id))),
    })
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Crear un cupón de porcentaje o monto fijo',
      descripcion:
        'Vigencia, compra mínima, límite total de usos, límite por cliente y, opcionalmente, una categoría a la que aplica.',
      acceso: SOLO_ADMIN,
      body: crearCuponEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(existente(await cuponesRepositorio.crear(usuarioDe(ctx).id, ctx.body))),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id',
      resumen: 'Editar un cupón (el código no se cambia)',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: actualizarCuponEsquema,
      manejador: async (ctx) =>
        respuesta(existente(await cuponesRepositorio.actualizar(usuarioDe(ctx).id, ctx.params.id, ctx.body))),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/estado',
      resumen: 'Activar o desactivar un cupón',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: z.strictObject({ activo: z.boolean() }),
      manejador: async (ctx) =>
        respuesta(existente(await cuponesRepositorio.cambiarEstado(usuarioDe(ctx).id, ctx.params.id, ctx.body.activo))),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/:id',
      resumen: 'Eliminar un cupón (o desactivarlo si ya se usó)',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await cuponesRepositorio.eliminar(usuarioDe(ctx).id, ctx.params.id)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id/usos',
      resumen: 'Pedidos en los que se usó el cupón',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      query: usosEsquema,
      manejador: async ({ params, query }) =>
        respuestaPaginada(await cuponesRepositorio.usos(params.id, query.pagina, query.tamanoPagina)),
    });
}
