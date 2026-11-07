import { pedir } from '@/api/cliente';
import { almacenSesion } from './almacen-sesion';
import type { RespuestaSesion, Usuario } from './tipos';

export interface DatosLogin {
  correo: string;
  contrasena: string;
}

export interface DatosRegistro {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string | undefined;
}

export async function iniciarSesion(datos: DatosLogin): Promise<Usuario> {
  const sesion = await pedir<RespuestaSesion>('/auth/login', { metodo: 'POST', cuerpo: datos });
  almacenSesion.establecer(sesion, true);
  return sesion.usuario;
}

export async function registrarse(datos: DatosRegistro): Promise<Usuario> {
  const sesion = await pedir<RespuestaSesion>('/auth/registro', { metodo: 'POST', cuerpo: datos });
  almacenSesion.establecer(sesion, true);
  return sesion.usuario;
}

/** Revoca el refresh token en la API (borra la cookie) y limpia la sesión de todas las pestañas. */
export async function cerrarSesion(): Promise<void> {
  try {
    await pedir<void>('/auth/logout', { metodo: 'POST' });
  } finally {
    almacenSesion.limpiar('manual', true);
  }
}
