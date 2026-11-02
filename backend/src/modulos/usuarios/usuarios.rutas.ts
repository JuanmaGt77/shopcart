import { idEnRuta } from '../../compartido/esquemas.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { SOLO_ADMIN } from '../../compartido/http/tipos.js';
import {
  actualizarUsuarioEsquema,
  crearUsuarioEsquema,
  estadoEsquema,
  listarUsuariosEsquema,
} from './usuarios.esquemas.js';
import { usuariosServicio } from './usuarios.servicio.js';

export function rutasUsuarios(): Modulo {
  return new Modulo('/api/usuarios', 'Usuarios')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Listar usuarios con filtros y paginación',
      acceso: SOLO_ADMIN,
      query: listarUsuariosEsquema,
      manejador: async ({ query }) => respuestaPaginada(await usuariosServicio.listar(query)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Ver un usuario',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      manejador: async ({ params }) => respuesta(await usuariosServicio.obtener(params.id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Crear un usuario (cliente, operador o administrador)',
      acceso: SOLO_ADMIN,
      body: crearUsuarioEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(await usuariosServicio.crear(usuarioDe(ctx).id, ctx.body)),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id',
      resumen: 'Actualizar datos y rol de un usuario',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: actualizarUsuarioEsquema,
      manejador: async (ctx) =>
        respuesta(await usuariosServicio.actualizar(usuarioDe(ctx).id, ctx.params.id, ctx.body)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/estado',
      resumen: 'Activar o desactivar un usuario (nunca se borra)',
      descripcion: 'Al desactivarlo se revocan sus sesiones y pierde el acceso de inmediato.',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: estadoEsquema,
      manejador: async (ctx) =>
        respuesta(await usuariosServicio.cambiarEstado(usuarioDe(ctx).id, ctx.params.id, ctx.body.activo)),
    });
}
