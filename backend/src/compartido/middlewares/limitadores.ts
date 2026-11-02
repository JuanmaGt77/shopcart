import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

interface OpcionesLimitador {
  maximo: number;
  ventanaMinutos: number;
  mensaje: string;
}

/**
 * Rate limiting por IP para los endpoints de autenticación (frena fuerza bruta y
 * registros masivos). Responde 429 con el mismo formato de error que el resto de la API.
 */
export function crearLimitador({ maximo, ventanaMinutos, mensaje }: OpcionesLimitador): RequestHandler {
  return rateLimit({
    windowMs: ventanaMinutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: { codigo: 'DEMASIADOS_INTENTOS', mensaje, idSolicitud: req.id },
      });
    },
  });
}
