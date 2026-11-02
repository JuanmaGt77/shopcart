/**
 * DEMO: escucha en vivo los eventos de tiempo real (WebSocket).
 *   npm run realtime:escuchar               como administrador (ve todo)
 *   npm run realtime:escuchar -- visitante  sin sesión (solo la tienda)
 *
 * Déjalo corriendo en una terminal y en otra haz compras, cambia estados de pedidos,
 * ajusta inventario o corre otra demo: los eventos aparecen aquí al instante.
 */
import { io } from 'socket.io-client';
import { BASE, color, loginAdmin, titulo, verificarApi } from './utilidades.js';

await verificarApi();
const comoVisitante = process.argv[2] === 'visitante';
const token = comoVisitante ? undefined : await loginAdmin();
titulo(`Escuchando eventos en ${BASE} como ${comoVisitante ? 'visitante' : 'administrador'} (Ctrl+C para salir)`);

const socket = io(BASE, { auth: token ? { token } : {}, transports: ['websocket'] });

socket.on('bienvenida', (datos: { salas: string[] }) => console.log(color.gris(`Conectado a las salas: ${datos.salas.join(', ')}`)));
socket.on('connect_error', (error) => console.error(color.rojo(`No se pudo conectar: ${error.message}`)));

const hora = () => new Date().toLocaleTimeString('es-GT');
const mostrar = (evento: string, resaltar: (t: string) => string) => (datos: unknown) =>
  console.log(`${color.gris(hora())} ${resaltar(evento.padEnd(22))} ${JSON.stringify(datos)}`);

socket.on('inventario:existencia', mostrar('inventario:existencia', color.amarillo));
socket.on('catalogo:actualizado', mostrar('catalogo:actualizado', color.amarillo));
socket.on('pedido:creado', mostrar('pedido:creado', color.verde));
socket.on('pedido:estado', mostrar('pedido:estado', color.verde));
socket.on('dashboard:actualizar', mostrar('dashboard:actualizar', color.negrita));
socket.on('carrito:actualizado', mostrar('carrito:actualizado', color.gris));
socket.on('checkout:expirado', mostrar('checkout:expirado', color.rojo));
socket.on('sesion:revocada', mostrar('sesion:revocada', color.rojo));
socket.on('sesion:expirada', async () => {
  console.log(color.gris('El token venció; reconectando con uno nuevo...'));
  socket.auth = { token: await loginAdmin() };
  socket.connect();
});
