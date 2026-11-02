import { ErrorNoEncontrado } from '../../compartido/errores.js';
import { direccionesRepositorio } from './direcciones.repositorio.js';
import type { CambiosDireccion, NuevaDireccion } from './direcciones.esquemas.js';

function existente<T>(valor: T | null): T {
  if (!valor) throw new ErrorNoEncontrado('La dirección no existe.', 'DIRECCION_NO_ENCONTRADA');
  return valor;
}

export const direccionesServicio = {
  listar: (idUsuario: number) => direccionesRepositorio.listar(idUsuario),

  async obtener(idUsuario: number, idDireccion: number) {
    return existente(await direccionesRepositorio.obtener(idUsuario, idDireccion));
  },

  async crear(idUsuario: number, datos: NuevaDireccion) {
    return existente(await direccionesRepositorio.crear(idUsuario, datos));
  },

  async actualizar(idUsuario: number, idDireccion: number, datos: CambiosDireccion) {
    return existente(await direccionesRepositorio.actualizar(idUsuario, idDireccion, datos));
  },

  async hacerPredeterminada(idUsuario: number, idDireccion: number) {
    return existente(await direccionesRepositorio.hacerPredeterminada(idUsuario, idDireccion));
  },

  async eliminar(idUsuario: number, idDireccion: number) {
    return existente(await direccionesRepositorio.eliminar(idUsuario, idDireccion));
  },
};
