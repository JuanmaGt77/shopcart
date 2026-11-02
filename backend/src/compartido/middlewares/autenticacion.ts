import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado, ErrorProhibido } from '../errores.js';
import type { Acceso } from '../http/tipos.js';
import { verificarAccessToken } from '../../modulos/auth/tokens.js';
import { obtenerEstadoUsuario } from '../../modulos/auth/estado-usuario.js';

function extraerToken(req: Request): string | null {
  const encabezado = req.headers.authorization;
  if (!encabezado?.startsWith('Bearer ')) return null;
  const token = encabezado.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * - 'publico': no revisa nada.
 * - 'opcional': si viene token lo valida (un token vencido da 401 para que el
 *   frontend lo renueve); si no viene, sigue como invitado.
 * - lista de roles: exige token válido (401) y que el rol esté en la lista (403).
 */
export function verificarAcceso(acceso: Acceso): RequestHandler {
  return async (req, _res, next) => {
    if (acceso === 'publico') return next();

    const token = extraerToken(req);
    if (!token) {
      if (acceso === 'opcional') return next();
      throw new ErrorNoAutenticado('TOKEN_REQUERIDO', 'Necesitas iniciar sesión para continuar.');
    }

    const datos = verificarAccessToken(token);
    const estado = await obtenerEstadoUsuario(datos.id);
    if (!estado || !estado.activo) {
      throw new ErrorNoAutenticado('SESION_REVOCADA', 'Tu cuenta está desactivada o ya no existe.');
    }

    // El rol sale de la base, no del token: si un admin lo cambia, aplica de inmediato
    req.usuario = { id: datos.id, rol: estado.rol, correo: datos.correo };

    if (acceso !== 'opcional' && !acceso.includes(estado.rol)) {
      throw new ErrorProhibido();
    }
    next();
  };
}
