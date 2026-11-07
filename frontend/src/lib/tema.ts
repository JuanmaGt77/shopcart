import { useSyncExternalStore } from 'react';

/**
 * Tema claro, oscuro o el del sistema. Se guarda en este navegador y se aplica con la clase
 * "dark" en <html> (los colores de shadcn/ui y de las gráficas ya están definidos para los dos).
 * public/tema.js aplica el tema guardado antes de que React pinte, para que no parpadee.
 */
export type Tema = 'light' | 'dark' | 'system';

const CLAVE = 'shopcart.tema';
const oyentes = new Set<() => void>();
const consultaOscuro =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function leerGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'light' || valor === 'dark' ? valor : 'system';
  } catch {
    return 'system';
  }
}

let tema: Tema = typeof window === 'undefined' ? 'system' : leerGuardado();

const esOscuro = () => tema === 'dark' || (tema === 'system' && (consultaOscuro?.matches ?? false));

function aplicar() {
  if (typeof document === 'undefined') return;
  const oscuro = esOscuro();
  document.documentElement.classList.toggle('dark', oscuro);
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
}

function avisar() {
  for (const oyente of oyentes) oyente();
}

// Si el usuario eligió "como el sistema", sigue los cambios del sistema operativo
consultaOscuro?.addEventListener('change', () => {
  if (tema !== 'system') return;
  aplicar();
  avisar();
});

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function cambiarTema(nuevo: Tema) {
  tema = nuevo;
  try {
    localStorage.setItem(CLAVE, nuevo);
  } catch {
    // Sin almacenamiento: el tema dura mientras la pestaña esté abierta
  }
  aplicar();
  avisar();
}

/** tema: lo que eligió el usuario; resuelto: lo que se ve ('light' | 'dark'). */
export function useTema(): { tema: Tema; resuelto: 'light' | 'dark' } {
  const elegido = useSyncExternalStore(
    suscribir,
    () => tema,
    () => 'system' as Tema,
  );
  const resuelto = useSyncExternalStore(
    suscribir,
    () => (esOscuro() ? 'dark' : 'light'),
    () => 'light' as const,
  );
  return { tema: elegido, resuelto };
}
