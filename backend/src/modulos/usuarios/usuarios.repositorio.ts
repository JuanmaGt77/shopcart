import { consultarPaginado, consultarUno } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { Perfil } from '../auth/auth.repositorio.js';
import type { CambiosUsuario, FiltroUsuarios } from './usuarios.esquemas.js';

export const usuariosRepositorio = {
  listar: (f: FiltroUsuarios) =>
    consultarPaginado<Perfil>(
      SP.Usuarios.Listar,
      [
        p.texto('Texto', 100, f.texto),
        p.ascii('Rol', 20, f.rol),
        p.bit('Activo', f.activo),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  obtener: (idUsuario: number) => consultarUno<Perfil>(SP.Usuarios.Obtener, [p.entero('IDUsuario', idUsuario)]),

  crear: (
    idAccion: number,
    datos: { correo: string; hash: string; nombres: string; apellidos: string; telefono?: string | undefined; rol: string },
  ) =>
    consultarUno<Perfil>(SP.Usuarios.Crear, [
      p.entero('IDUsuarioAccion', idAccion),
      p.texto('Correo', 254, datos.correo),
      p.ascii('HashContrasena', 255, datos.hash),
      p.texto('Nombres', 100, datos.nombres),
      p.texto('Apellidos', 100, datos.apellidos),
      p.ascii('Telefono', 20, datos.telefono),
      p.ascii('Rol', 20, datos.rol),
    ]),

  actualizar: (idAccion: number, idUsuario: number, datos: CambiosUsuario) =>
    consultarUno<Perfil>(SP.Usuarios.Actualizar, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDUsuario', idUsuario),
      p.texto('Nombres', 100, datos.nombres),
      p.texto('Apellidos', 100, datos.apellidos),
      p.ascii('Telefono', 20, datos.telefono),
      p.ascii('Rol', 20, datos.rol),
    ]),

  cambiarEstado: (idAccion: number, idUsuario: number, activo: boolean) =>
    consultarUno<Perfil>(SP.Usuarios.CambiarEstado, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDUsuario', idUsuario),
      p.bit('Activo', activo),
    ]),
};
