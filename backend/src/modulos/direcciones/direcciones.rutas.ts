import { idEnRuta } from '../../compartido/esquemas.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import { SOLO_CLIENTE } from '../../compartido/http/tipos.js';
import { actualizarDireccionEsquema, crearDireccionEsquema } from './direcciones.esquemas.js';
import { direccionesServicio } from './direcciones.servicio.js';

export function rutasDirecciones(): Modulo {
  return new Modulo('/api/direcciones', 'Direcciones')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Mis direcciones de entrega',
      acceso: SOLO_CLIENTE,
      manejador: async (ctx) => respuesta(await direccionesServicio.listar(usuarioDe(ctx).id)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Ver una de mis direcciones',
      descripcion: 'Si el ID es de una dirección de otro cliente responde 403.',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await direccionesServicio.obtener(usuarioDe(ctx).id, ctx.params.id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Registrar una dirección',
      descripcion: 'La primera dirección queda como predeterminada.',
      acceso: SOLO_CLIENTE,
      body: crearDireccionEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(await direccionesServicio.crear(usuarioDe(ctx).id, ctx.body)),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id',
      resumen: 'Editar una de mis direcciones',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      body: actualizarDireccionEsquema,
      manejador: async (ctx) =>
        respuesta(await direccionesServicio.actualizar(usuarioDe(ctx).id, ctx.params.id, ctx.body)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/predeterminada',
      resumen: 'Marcar una dirección como predeterminada',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      manejador: async (ctx) =>
        respuesta(await direccionesServicio.hacerPredeterminada(usuarioDe(ctx).id, ctx.params.id)),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/:id',
      resumen: 'Eliminar una de mis direcciones',
      descripcion: 'Se desactiva (los pedidos anteriores conservan su copia de la dirección).',
      acceso: SOLO_CLIENTE,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await direccionesServicio.eliminar(usuarioDe(ctx).id, ctx.params.id)),
    });
}
