import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import type { UsuarioAutenticado } from '../../compartido/http/tipos.js';
import type { MetadatosSesion } from './auth.repositorio.js';
import { authServicio, type Sesion } from './auth.servicio.js';
import type { DatosLogin, DatosRegistro } from './auth.esquemas.js';

export const COOKIE_REFRESH = 'shopcart_rt';

/**
 * El refresh token viaja solo en una cookie httpOnly: el JavaScript del navegador no
 * puede leerlo (protege contra XSS) y únicamente se envía a /api/auth.
 * El access token sí va en el cuerpo; el frontend lo guarda en memoria.
 */
function opcionesCookie(expira?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    ...(expira ? { expires: expira } : {}),
  };
}

function metadatos(req: Request): MetadatosSesion {
  return { ip: req.ip, agente: req.get('user-agent') };
}

function responderSesion(res: Response, sesion: Sesion) {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, opcionesCookie(sesion.refreshExpira));
  return respuesta({ usuario: sesion.usuario, accessToken: sesion.accessToken, expiraEn: sesion.expiraEn });
}

function refreshDe(req: Request): string | undefined {
  const valor: unknown = req.cookies?.[COOKIE_REFRESH];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

export const authControlador = {
  async registrar(body: DatosRegistro, req: Request, res: Response) {
    return responderSesion(res, await authServicio.registrar(body, metadatos(req)));
  },

  async iniciarSesion(body: DatosLogin, req: Request, res: Response) {
    return responderSesion(res, await authServicio.iniciarSesion(body, metadatos(req)));
  },

  async renovar(req: Request, res: Response) {
    try {
      return responderSesion(res, await authServicio.renovar(refreshDe(req), metadatos(req)));
    } catch (error) {
      res.clearCookie(COOKIE_REFRESH, opcionesCookie());
      throw error;
    }
  },

  async cerrarSesion(req: Request, res: Response) {
    await authServicio.cerrarSesion(refreshDe(req));
    res.clearCookie(COOKIE_REFRESH, opcionesCookie());
    return undefined;
  },

  async perfil(usuario: UsuarioAutenticado) {
    return respuesta(await authServicio.perfil(usuario.id));
  },
};
