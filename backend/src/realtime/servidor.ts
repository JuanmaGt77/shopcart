import type { Server as ServidorHttp } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { ErrorAplicacion } from '../compartido/errores.js';
import { eventosDominio } from '../compartido/eventos-dominio.js';
import { logger } from '../compartido/logger.js';
import type { Rol } from '../compartido/http/tipos.js';
import { obtenerEstadoUsuario } from '../modulos/auth/estado-usuario.js';
import { verificarAccessToken } from '../modulos/auth/tokens.js';

/**
 * Tiempo real con Socket.IO (WebSockets).
 *
 * Al conectarse, el cliente puede mandar su access token en `auth.token`.
 *   - Sin token: entra solo a la sala "catalogo" (existencias y cambios de la tienda).
 *   - Con token válido: además entra a "usuario:{id}" y "rol:{ROL}".
 * Cuando el token vence, el servidor avisa con "sesion:expirada" y cierra el socket;
 * el frontend se reconecta con el token renovado.
 *
 * Eventos que emite el servidor:
 *   inventario:existencia  -> catalogo             disponibilidad actualizada por variante
 *   catalogo:actualizado   -> catalogo             producto/variante/categoría creado o modificado
 *   pedido:creado          -> personal y el cliente
 *   pedido:estado          -> el cliente dueño y el personal
 *   dashboard:actualizar   -> rol:ADMIN            algo cambió las ventas: volver a pedir los reportes
 *   carrito:actualizado    -> usuario:{id}         sincroniza el carrito entre pestañas/dispositivos
 *   checkout:expirado      -> usuario:{id}         su reserva de 15 minutos venció
 *   sesion:revocada        -> usuario:{id}         un admin lo desactivó; se cierra el socket
 */
interface UsuarioSocket {
  id: number;
  rol: Rol;
}

const PERSONAL = ['rol:OPERADOR', 'rol:ADMIN'];

function conectarEventosDeDominio(io: Server): () => void {
  let motivosDashboard: string[] = [];
  let temporizador: NodeJS.Timeout | null = null;

  // Varias ventas seguidas producen un solo aviso al dashboard (agrupado en 1 segundo)
  const avisarDashboard = ({ motivo }: { motivo: string }) => {
    motivosDashboard.push(motivo);
    temporizador ??= setTimeout(() => {
      io.to('rol:ADMIN').emit('dashboard:actualizar', { motivos: motivosDashboard, fecha: new Date().toISOString() });
      motivosDashboard = [];
      temporizador = null;
    }, 1000);
  };

  const oyentes = {
    'inventario:cambio': (variantes: unknown[]) =>
      io.to('catalogo').emit('inventario:existencia', { variantes, fecha: new Date().toISOString() }),
    'catalogo:cambio': (cambio: object) =>
      io.to('catalogo').emit('catalogo:actualizado', { ...cambio, fecha: new Date().toISOString() }),
    'pedido:creado': (pedido: { idUsuario: number }) =>
      io.to([...PERSONAL, `usuario:${pedido.idUsuario}`]).emit('pedido:creado', pedido),
    'pedido:estado': (cambio: { idUsuario: number }) =>
      io.to([...PERSONAL, `usuario:${cambio.idUsuario}`]).emit('pedido:estado', { ...cambio, fecha: new Date().toISOString() }),
    'ventas:cambiaron': avisarDashboard,
    'carrito:cambio': (carrito: { idUsuario: number }) =>
      io.to(`usuario:${carrito.idUsuario}`).emit('carrito:actualizado', carrito),
    'checkout:expirado': (datos: { idUsuario: number; idCheckout: number }) =>
      io.to(`usuario:${datos.idUsuario}`).emit('checkout:expirado', datos),
    'sesion:revocada': ({ idUsuario }: { idUsuario: number }) => {
      io.to(`usuario:${idUsuario}`).emit('sesion:revocada', { mensaje: 'Tu cuenta fue desactivada.' });
      io.in(`usuario:${idUsuario}`).disconnectSockets(true);
    },
  } as const;

  for (const [evento, oyente] of Object.entries(oyentes)) {
    eventosDominio.on(evento as never, oyente as never);
  }
  return () => {
    for (const [evento, oyente] of Object.entries(oyentes)) {
      eventosDominio.off(evento as never, oyente as never);
    }
    if (temporizador) clearTimeout(temporizador);
  };
}

export function iniciarTiempoReal(servidorHttp: ServidorHttp): Server {
  const io = new Server(servidorHttp, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  // Autenticación en el handshake con el mismo JWT de la API
  io.use(async (socket, siguiente) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== 'string' || token.length === 0) {
      socket.data.usuario = null;
      return siguiente();
    }
    try {
      const datos = verificarAccessToken(token);
      const estado = await obtenerEstadoUsuario(datos.id);
      if (!estado?.activo) return siguiente(new Error('SESION_REVOCADA'));
      socket.data.usuario = { id: datos.id, rol: estado.rol } satisfies UsuarioSocket;
      socket.data.expira = datos.expira;
      siguiente();
    } catch (error) {
      siguiente(new Error(error instanceof ErrorAplicacion ? error.codigo : 'TOKEN_INVALIDO'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join('catalogo');
    const usuario = socket.data.usuario as UsuarioSocket | null;

    if (usuario) {
      void socket.join([`usuario:${usuario.id}`, `rol:${usuario.rol}`]);

      const expira = socket.data.expira as number | undefined;
      if (expira) {
        const temporizador = setTimeout(() => {
          socket.emit('sesion:expirada', { mensaje: 'Tu token venció; reconéctate con el token renovado.' });
          socket.disconnect(true);
        }, Math.max(expira * 1000 - Date.now(), 0));
        socket.on('disconnect', () => clearTimeout(temporizador));
      }
    }

    socket.emit('bienvenida', { salas: [...socket.rooms].filter((sala) => sala !== socket.id) });
  });

  const desconectar = conectarEventosDeDominio(io);
  io.on('close', desconectar);
  servidorHttp.on('close', desconectar);

  logger.info('Tiempo real (Socket.IO) listo');
  return io;
}
