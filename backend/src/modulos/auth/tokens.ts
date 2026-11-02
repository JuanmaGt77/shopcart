import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ErrorNoAutenticado } from '../../compartido/errores.js';
import type { Rol } from '../../compartido/http/tipos.js';

const EMISOR = 'shopcart-api';
const AUDIENCIA = 'shopcart';

export interface DatosToken {
  id: number;
  rol: Rol;
  correo: string;
}

/** Access token de corta duración (15 min por defecto), firmado con HS256. */
export function firmarAccessToken(usuario: DatosToken): string {
  return jwt.sign({ rol: usuario.rol, correo: usuario.correo }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRA as jwt.SignOptions['expiresIn'],
    issuer: EMISOR,
    audience: AUDIENCIA,
    subject: String(usuario.id),
  });
}

/**
 * Verifica firma, emisor, audiencia y expiración. Solo acepta HS256: así nadie puede
 * mandar un token con "alg: none" o con otro algoritmo para saltarse la firma.
 */
export function verificarAccessToken(token: string): DatosToken {
  try {
    const datos = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: EMISOR,
      audience: AUDIENCIA,
    }) as jwt.JwtPayload;

    const id = Number(datos.sub);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Sujeto inválido');
    return { id, rol: datos['rol'] as Rol, correo: String(datos['correo'] ?? '') };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ErrorNoAutenticado('TOKEN_EXPIRADO', 'Tu sesión expiró. Renueva el token para continuar.');
    }
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'El token de acceso no es válido.');
  }
}

/** Refresh token opaco de 256 bits. Al cliente se le entrega el valor; en la base solo se guarda su hash. */
export function generarRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Segundos de vida del access token (para decirle al frontend cuándo renovar). */
export function segundosDeVidaAccessToken(): number {
  const valor = Number.parseInt(env.JWT_ACCESS_EXPIRA, 10);
  const unidad = env.JWT_ACCESS_EXPIRA.slice(-1);
  const factor = unidad === 'h' ? 3600 : unidad === 'd' ? 86400 : unidad === 'm' ? 60 : 1;
  return valor * factor;
}
