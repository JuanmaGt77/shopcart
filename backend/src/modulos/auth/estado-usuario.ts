import { CacheTTL } from '../../compartido/cache.js';
import type { Rol } from '../../compartido/http/tipos.js';
import { consultarUno } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';

export interface EstadoUsuario {
  idUsuario: number;
  activo: boolean;
  rol: Rol;
}

/**
 * En cada solicitud autenticada se confirma que el usuario siga activo y se toma su
 * rol actual de la base (no del token). Para no ir a la base en cada request se
 * guarda 30 segundos; cuando un administrador desactiva a alguien o le cambia el rol
 * se invalida al instante, así el cambio aplica de inmediato.
 */
const cache = new CacheTTL<EstadoUsuario | null>(30_000);

export async function obtenerEstadoUsuario(idUsuario: number): Promise<EstadoUsuario | null> {
  const clave = String(idUsuario);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const estado = await consultarUno<EstadoUsuario>(SP.Seguridad.ObtenerEstadoUsuario, [
    p.entero('IDUsuario', idUsuario),
  ]);
  cache.guardar(clave, estado);
  return estado;
}

export function invalidarEstadoUsuario(idUsuario: number): void {
  cache.eliminar(String(idUsuario));
}
