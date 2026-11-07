/**
 * Una sola conexión Socket.IO para toda la aplicación.
 *
 * - Se conecta al mismo origen (/socket.io lo reenvía el proxy) y manda el access token en el
 *   handshake. Sin sesión entra como visitante (solo recibe los cambios de la tienda).
 * - Cuando alguien inicia o cierra sesión se reconecta, para entrar o salir de sus salas.
 * - Cuando el token vence, el servidor avisa con "sesion:expirada" y cierra el socket: se renueva
 *   el token y se vuelve a conectar.
 */
import { io, type Socket } from 'socket.io-client';
import { almacenSesion, renovarSesion } from '@/modulos/auth/almacen-sesion';

export type EstadoConexion = 'conectando' | 'conectado' | 'desconectado';

export const socket: Socket = io({
  autoConnect: false,
  transports: ['websocket', 'polling'],
  // Se evalúa en cada (re)conexión, así siempre viaja el token vigente
  auth: (responder) => responder({ token: almacenSesion.token() ?? '' }),
});

let estadoConexion: EstadoConexion = 'desconectado';
const oyentesConexion = new Set<() => void>();

function cambiarEstado(nuevo: EstadoConexion) {
  estadoConexion = nuevo;
  for (const oyente of oyentesConexion) oyente();
}

export const conexion = {
  obtener: () => estadoConexion,
  suscribir(oyente: () => void) {
    oyentesConexion.add(oyente);
    return () => oyentesConexion.delete(oyente);
  },
};

socket.on('connect', () => cambiarEstado('conectado'));
socket.on('disconnect', (motivo) => {
  cambiarEstado('desconectado');
  // Si el servidor cerró la conexión (token vencido), Socket.IO no reintenta solo
  if (motivo === 'io server disconnect') void reconectarConTokenVigente();
});
socket.on('connect_error', (error) => {
  cambiarEstado('desconectado');
  if (error.message === 'TOKEN_EXPIRADO' || error.message === 'TOKEN_INVALIDO')
    void reconectarConTokenVigente();
  if (error.message === 'SESION_REVOCADA') almacenSesion.limpiar('revocada');
});
socket.on('sesion:expirada', () => void reconectarConTokenVigente());

async function reconectarConTokenVigente() {
  if (almacenSesion.obtener().usuario) await renovarSesion();
  socket.connect();
}

/** Arranca la conexión y la reinicia cada vez que cambia quién tiene la sesión. */
export function iniciarTiempoReal(): () => void {
  let idActual = almacenSesion.obtener().usuario?.idUsuario ?? null;
  cambiarEstado('conectando');
  socket.connect();

  const dejarDeEscuchar = almacenSesion.suscribir(() => {
    const sesion = almacenSesion.obtener();
    if (sesion.estado === 'cargando') return;
    const idNuevo = sesion.usuario?.idUsuario ?? null;
    if (idNuevo === idActual) return;
    idActual = idNuevo;
    cambiarEstado('conectando');
    socket.disconnect().connect();
  });

  return () => {
    dejarDeEscuchar();
    socket.disconnect();
  };
}
