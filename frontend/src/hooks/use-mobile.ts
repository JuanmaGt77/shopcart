import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const consulta = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function suscribirse(avisar: () => void) {
  const mql = window.matchMedia(consulta);
  mql.addEventListener('change', avisar);
  return () => mql.removeEventListener('change', avisar);
}

/** true en pantallas menores a 768 px. Lo usa el menú lateral para mostrarse como panel deslizable. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    suscribirse,
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}
