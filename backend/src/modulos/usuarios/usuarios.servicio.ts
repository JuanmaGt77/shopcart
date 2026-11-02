import { ErrorNoEncontrado } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import { invalidarEstadoUsuario } from '../auth/estado-usuario.js';
import { hashearContrasena } from '../auth/auth.servicio.js';
import { usuariosRepositorio } from './usuarios.repositorio.js';
import type { CambiosUsuario, FiltroUsuarios, NuevoUsuario } from './usuarios.esquemas.js';

function existente<T>(valor: T | null): T {
  if (!valor) throw new ErrorNoEncontrado('El usuario no existe.', 'USUARIO_NO_ENCONTRADO');
  return valor;
}

export const usuariosServicio = {
  listar: (filtro: FiltroUsuarios) => usuariosRepositorio.listar(filtro),

  async obtener(idUsuario: number) {
    return existente(await usuariosRepositorio.obtener(idUsuario));
  },

  async crear(idAccion: number, datos: NuevoUsuario) {
    const hash = await hashearContrasena(datos.contrasena);
    return existente(await usuariosRepositorio.crear(idAccion, { ...datos, hash }));
  },

  async actualizar(idAccion: number, idUsuario: number, datos: CambiosUsuario) {
    const perfil = existente(await usuariosRepositorio.actualizar(idAccion, idUsuario, datos));
    // Si le cambiaron el rol, que aplique desde la siguiente solicitud
    invalidarEstadoUsuario(idUsuario);
    return perfil;
  },

  async cambiarEstado(idAccion: number, idUsuario: number, activo: boolean) {
    const perfil = existente(await usuariosRepositorio.cambiarEstado(idAccion, idUsuario, activo));
    invalidarEstadoUsuario(idUsuario);
    // Un usuario desactivado pierde el acceso al instante, incluso con un access token vigente
    if (!activo) eventosDominio.emit('sesion:revocada', { idUsuario });
    return perfil;
  },
};
