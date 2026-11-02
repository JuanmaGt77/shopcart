import { consultarUno } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { Rol } from '../../compartido/http/tipos.js';

export interface Perfil {
  idUsuario: number;
  correo: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  fechaCreacion: Date;
  fechaUltimoAcceso: Date | null;
}

export interface UsuarioParaLogin {
  idUsuario: number;
  correo: string;
  hashContrasena: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  activo: boolean;
}

export type ResultadoRotacion =
  | 'OK'
  | 'TOKEN_INVALIDO'
  | 'TOKEN_EXPIRADO'
  | 'TOKEN_YA_ROTADO'
  | 'REUSO_DETECTADO'
  | 'USUARIO_INACTIVO';

export interface Rotacion {
  resultado: ResultadoRotacion;
  idUsuario: number | null;
  correo: string | null;
  nombres: string | null;
  apellidos: string | null;
  rol: Rol | null;
}

export interface MetadatosSesion {
  ip?: string | undefined;
  agente?: string | undefined;
}

export const authRepositorio = {
  registrarCliente(datos: {
    correo: string;
    hash: string;
    nombres: string;
    apellidos: string;
    telefono?: string | undefined;
  }) {
    return consultarUno<Perfil>(SP.Seguridad.RegistrarCliente, [
      p.texto('Correo', 254, datos.correo),
      p.ascii('HashContrasena', 255, datos.hash),
      p.texto('Nombres', 100, datos.nombres),
      p.texto('Apellidos', 100, datos.apellidos),
      p.ascii('Telefono', 20, datos.telefono),
    ]);
  },

  obtenerParaLogin(correo: string) {
    return consultarUno<UsuarioParaLogin>(SP.Seguridad.ObtenerUsuarioParaLogin, [p.texto('Correo', 254, correo)]);
  },

  iniciarSesion(idUsuario: number, hashToken: string, familia: string, expira: Date, meta: MetadatosSesion) {
    return consultarUno<Perfil>(SP.Seguridad.IniciarSesion, [
      p.entero('IDUsuario', idUsuario),
      p.caracteres('HashToken', 64, hashToken),
      p.guid('Familia', familia),
      p.fechaHora('FechaExpiracion', expira),
      p.ascii('DireccionIP', 45, meta.ip),
      p.texto('AgenteUsuario', 300, meta.agente?.slice(0, 300)),
    ]);
  },

  rotarRefreshToken(hashActual: string, hashNuevo: string, expira: Date, meta: MetadatosSesion) {
    return consultarUno<Rotacion>(SP.Seguridad.RotarTokenRefresco, [
      p.caracteres('HashTokenActual', 64, hashActual),
      p.caracteres('HashTokenNuevo', 64, hashNuevo),
      p.fechaHora('FechaExpiracionNueva', expira),
      p.ascii('DireccionIP', 45, meta.ip),
      p.texto('AgenteUsuario', 300, meta.agente?.slice(0, 300)),
    ]);
  },

  cerrarSesion(hashToken: string) {
    return consultarUno<{ sesionCerrada: boolean }>(SP.Seguridad.CerrarSesion, [
      p.caracteres('HashToken', 64, hashToken),
    ]);
  },

  obtenerPerfil(idUsuario: number) {
    return consultarUno<Perfil>(SP.Seguridad.ObtenerPerfil, [p.entero('IDUsuario', idUsuario)]);
  },
};
