import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ErrorAplicacion, ErrorValidacion } from '../errores.js';
import { traducirErrorBD } from '../../db/errores-bd.js';

function normalizar(error: unknown): ErrorAplicacion {
  if (error instanceof ErrorAplicacion) return error;

  if (error instanceof ZodError) {
    return new ErrorValidacion(
      'Los datos enviados no son válidos.',
      error.issues.map((issue) => ({
        campo: issue.path.join('.') || '(cuerpo)',
        mensaje: issue.message,
      })),
    );
  }

  const tipo = (error as { type?: string } | null)?.type;
  if (tipo === 'entity.parse.failed') {
    return new ErrorAplicacion(400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es un JSON válido.');
  }
  if (tipo === 'entity.too.large') {
    return new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo de la solicitud es demasiado grande.');
  }

  return (
    traducirErrorBD(error) ??
    new ErrorAplicacion(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intenta de nuevo más tarde.')
  );
}

/**
 * Manejo centralizado: todas las respuestas de error tienen la misma forma
 * { error: { codigo, mensaje, detalles?, idSolicitud } }. Los detalles internos
 * (pila, mensajes de SQL Server) solo van al log, nunca al cliente.
 */
export const manejadorErrores: ErrorRequestHandler = (error, req, res, _next) => {
  const normalizado = normalizar(error);

  if (normalizado.estado >= 500) req.log?.error({ err: error }, 'Error no controlado');
  else req.log?.debug({ codigo: normalizado.codigo }, normalizado.message);

  if (res.headersSent) return;
  res.status(normalizado.estado).json({
    error: {
      codigo: normalizado.codigo,
      mensaje: normalizado.message,
      ...(normalizado.detalles !== undefined ? { detalles: normalizado.detalles } : {}),
      idSolicitud: req.id,
    },
  });
};

export const rutaNoEncontrada: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `No existe la ruta ${req.method} ${req.path}`,
      idSolicitud: req.id,
    },
  });
};
