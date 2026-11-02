import { randomUUID } from 'node:crypto';
import { hash, verify, type Algorithm } from '@node-rs/argon2';
import { env } from '../../config/env.js';
import { ErrorAplicacion, ErrorNoAutenticado, ErrorNoEncontrado, ErrorProhibido } from '../../compartido/errores.js';
import { logger } from '../../compartido/logger.js';
import { authRepositorio, type MetadatosSesion, type Perfil } from './auth.repositorio.js';
import type { DatosLogin, DatosRegistro } from './auth.esquemas.js';
import {
  firmarAccessToken,
  generarRefreshToken,
  hashDeToken,
  segundosDeVidaAccessToken,
} from './tokens.js';

// Parámetros recomendados por OWASP para argon2id (19 MiB de memoria, 2 iteraciones).
// Algorithm es un const enum de la librería: 2 = Argon2id.
const OPCIONES_HASH = { algorithm: 2 as Algorithm, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashearContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, OPCIONES_HASH);
}

// Si el correo no existe igual se verifica contra un hash, para que la respuesta tarde
// lo mismo y no se pueda averiguar qué correos están registrados midiendo el tiempo.
let hashFicticio: Promise<string> | null = null;
function obtenerHashFicticio(): Promise<string> {
  hashFicticio ??= hashearContrasena('contrasena-que-no-pertenece-a-nadie');
  return hashFicticio;
}

export interface Sesion {
  usuario: Perfil;
  accessToken: string;
  expiraEn: number;
  refreshToken: string;
  refreshExpira: Date;
}

function expiracionRefresh(): Date {
  return new Date(Date.now() + env.REFRESH_DIAS * 24 * 60 * 60 * 1000);
}

function credencialesInvalidas(): ErrorAplicacion {
  return new ErrorNoAutenticado('CREDENCIALES_INVALIDAS', 'El correo o la contraseña no son correctos.');
}

async function abrirSesion(idUsuario: number, meta: MetadatosSesion): Promise<Sesion> {
  const refreshToken = generarRefreshToken();
  const refreshExpira = expiracionRefresh();
  const perfil = await authRepositorio.iniciarSesion(
    idUsuario,
    hashDeToken(refreshToken),
    randomUUID(),
    refreshExpira,
    meta,
  );
  if (!perfil) throw new ErrorNoEncontrado('El usuario no existe.');

  return {
    usuario: perfil,
    accessToken: firmarAccessToken({ id: perfil.idUsuario, rol: perfil.rol, correo: perfil.correo }),
    expiraEn: segundosDeVidaAccessToken(),
    refreshToken,
    refreshExpira,
  };
}

export const authServicio = {
  /** Registro público: siempre crea un Cliente y deja la sesión iniciada. */
  async registrar(datos: DatosRegistro, meta: MetadatosSesion): Promise<Sesion> {
    const perfil = await authRepositorio.registrarCliente({
      correo: datos.correo,
      hash: await hashearContrasena(datos.contrasena),
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      telefono: datos.telefono,
    });
    if (!perfil) throw new ErrorAplicacion(500, 'ERROR_INTERNO', 'No se pudo crear la cuenta.');
    return abrirSesion(perfil.idUsuario, meta);
  },

  async iniciarSesion(datos: DatosLogin, meta: MetadatosSesion): Promise<Sesion> {
    const usuario = await authRepositorio.obtenerParaLogin(datos.correo);
    if (!usuario) {
      await verify(await obtenerHashFicticio(), datos.contrasena);
      throw credencialesInvalidas();
    }

    const valida = await verify(usuario.hashContrasena, datos.contrasena);
    if (!valida) throw credencialesInvalidas();

    // Solo se revela que la cuenta está desactivada si la contraseña era correcta
    if (!usuario.activo) {
      throw new ErrorProhibido('Tu cuenta está desactivada. Comunícate con la tienda.', 'CUENTA_DESACTIVADA');
    }
    return abrirSesion(usuario.idUsuario, meta);
  },

  /** Rota el refresh token: el usado queda revocado y se entrega uno nuevo de la misma familia. */
  async renovar(refreshToken: string | undefined, meta: MetadatosSesion): Promise<Sesion> {
    if (!refreshToken) {
      throw new ErrorNoAutenticado('REFRESH_REQUERIDO', 'No hay una sesión activa que renovar.');
    }

    const nuevo = generarRefreshToken();
    const refreshExpira = expiracionRefresh();
    const rotacion = await authRepositorio.rotarRefreshToken(
      hashDeToken(refreshToken),
      hashDeToken(nuevo),
      refreshExpira,
      meta,
    );

    switch (rotacion?.resultado) {
      case 'OK': {
        const perfil = await authRepositorio.obtenerPerfil(rotacion.idUsuario ?? 0);
        if (!perfil) throw credencialesInvalidas();
        return {
          usuario: perfil,
          accessToken: firmarAccessToken({ id: perfil.idUsuario, rol: perfil.rol, correo: perfil.correo }),
          expiraEn: segundosDeVidaAccessToken(),
          refreshToken: nuevo,
          refreshExpira,
        };
      }
      case 'TOKEN_EXPIRADO':
        throw new ErrorNoAutenticado('REFRESH_EXPIRADO', 'Tu sesión expiró. Inicia sesión de nuevo.');
      case 'TOKEN_YA_ROTADO':
        throw new ErrorNoAutenticado('REFRESH_YA_USADO', 'Ese token ya se renovó hace un momento; usa el más reciente.');
      case 'REUSO_DETECTADO':
        logger.warn({ ip: meta.ip }, 'Se presentó un refresh token ya rotado: se revocó toda la familia');
        throw new ErrorNoAutenticado(
          'REFRESH_REUTILIZADO',
          'Detectamos un uso sospechoso de tu sesión y la cerramos por seguridad. Inicia sesión de nuevo.',
        );
      case 'USUARIO_INACTIVO':
        throw new ErrorNoAutenticado('SESION_REVOCADA', 'Tu cuenta está desactivada.');
      default:
        throw new ErrorNoAutenticado('REFRESH_INVALIDO', 'La sesión no es válida. Inicia sesión de nuevo.');
    }
  },

  async cerrarSesion(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await authRepositorio.cerrarSesion(hashDeToken(refreshToken));
  },

  async perfil(idUsuario: number): Promise<Perfil> {
    const perfil = await authRepositorio.obtenerPerfil(idUsuario);
    if (!perfil) throw new ErrorNoEncontrado('El usuario no existe.');
    return perfil;
  },
};
