import { useSyncExternalStore } from 'react';
import { almacenSesion, type EstadoSesion } from './almacen-sesion';

/** Estado de la sesión; el componente se vuelve a dibujar cuando alguien inicia o cierra sesión. */
export function useSesion(): EstadoSesion {
  return useSyncExternalStore(almacenSesion.suscribir, almacenSesion.obtener);
}
