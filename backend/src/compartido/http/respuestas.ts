import type { ResultadoPaginado } from '../../db/ejecutor.js';

/** Todas las respuestas exitosas tienen la forma { datos } o { datos, paginacion }. */
export function respuesta<T>(datos: T): { datos: T } {
  return { datos };
}

export function respuestaPaginada<T>(resultado: ResultadoPaginado<T>) {
  return { datos: resultado.items, paginacion: resultado.paginacion };
}
