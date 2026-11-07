/**
 * Sesión del navegador.
 *
 * - El access token vive SOLO en memoria (esta variable). No se guarda en localStorage: un script
 *   inyectado (XSS) no tendría de dónde leerlo. Al recargar la página se pierde, y se recupera
 *   llamando a /api/auth/refresh con la cookie httpOnly que puso la API.
 * - Se renueva solo un minuto antes de vencer y, si aun así vence, el cliente HTTP lo renueva
 *   al recibir 401. Varias renovaciones simultáneas comparten la misma promesa (una sola llamada).
 * - Las pestañas se avisan entre sí (BroadcastChannel) cuando alguien inicia o cierra sesión.
 */
import type { RespuestaSesion, Usuario } from './tipos';

export type MotivoCierre = 'manual' | 'expirada' | 'revocada';

export interface EstadoSesion {
  estado: 'cargando' | 'anonimo' | 'autenticado';
  usuario: Usuario | null;
  /** Por qué se cerró la última sesión (para avisar al usuario). */
  motivoCierre: MotivoCierre | null;
}

const MARGEN_RENOVACION_MS = 60_000;

let estado: EstadoSesion = { estado: 'cargando', usuario: null, motivoCierre: null };
let accessToken: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let renovacionEnCurso: Promise<boolean> | null = null;
const oyentes = new Set<() => void>();

const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('shopcart-sesion');

function emitir(nuevo: EstadoSesion) {
  estado = nuevo;
  for (const oyente of oyentes) oyente();
}

function programarRenovacion(segundosDeVida: number) {
  if (temporizador) clearTimeout(temporizador);
  const espera = Math.max(segundosDeVida * 1000 - MARGEN_RENOVACION_MS, 5_000);
  temporizador = setTimeout(() => void renovarSesion(), espera);
}

export const almacenSesion = {
  obtener: (): EstadoSesion => estado,

  suscribir(oyente: () => void): () => void {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
  },

  token: (): string | null => accessToken,

  /** Guarda la sesión que devolvió login, registro o refresh. */
  establecer(sesion: RespuestaSesion, avisarOtrasPestanas = false) {
    accessToken = sesion.accessToken;
    programarRenovacion(sesion.expiraEn);
    emitir({ estado: 'autenticado', usuario: sesion.usuario, motivoCierre: null });
    if (avisarOtrasPestanas) canal?.postMessage('iniciada');
  },

  /** Borra la sesión del navegador (la cookie la borra la API en /auth/logout). */
  limpiar(motivo: MotivoCierre, avisarOtrasPestanas = false) {
    const teniaSesion = estado.estado === 'autenticado';
    accessToken = null;
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    emitir({ estado: 'anonimo', usuario: null, motivoCierre: teniaSesion ? motivo : null });
    if (avisarOtrasPestanas) canal?.postMessage('cerrada');
  },
};

/**
 * Pide un access token nuevo con la cookie del refresh token. Devuelve true si lo consiguió.
 * Si ya hay una renovación en curso, devuelve esa misma promesa (nunca hay dos llamadas a la vez).
 */
export function renovarSesion(): Promise<boolean> {
  renovacionEnCurso ??= (async () => {
    try {
      const respuesta = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (!respuesta.ok) {
        almacenSesion.limpiar('expirada');
        return false;
      }
      const { datos } = (await respuesta.json()) as { datos: RespuestaSesion };
      almacenSesion.establecer(datos);
      return true;
    } catch {
      // Sin red: si estaba cargando, la tienda arranca como visitante
      if (estado.estado === 'cargando') emitir({ estado: 'anonimo', usuario: null, motivoCierre: null });
      return false;
    } finally {
      renovacionEnCurso = null;
    }
  })();
  return renovacionEnCurso;
}

canal?.addEventListener('message', (evento: MessageEvent<string>) => {
  if (evento.data === 'cerrada') almacenSesion.limpiar('manual');
  if (evento.data === 'iniciada') void renovarSesion();
});
