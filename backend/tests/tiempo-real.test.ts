import { createServer, type Server as ServidorHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as conectar, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import { iniciarTiempoReal } from '../src/realtime/servidor.js';
import { app, api, comprar, nuevoCliente, nuevoProducto, tokenAdmin, tokenOperador } from './ayudantes.js';

let servidor: ServidorHttp;
let io: Server;
let url: string;
const sockets: Socket[] = [];

function abrirSocket(token?: string): Promise<Socket> {
  return new Promise((resolver, rechazar) => {
    const socket = conectar(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.once('bienvenida', () => resolver(socket));
    socket.once('connect_error', rechazar);
  });
}

function esperarEvento<T>(socket: Socket, evento: string, filtro: (datos: T) => boolean = () => true, ms = 5000): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`No llegó el evento ${evento}`)), ms);
    const oyente = (datos: T) => {
      if (!filtro(datos)) return;
      clearTimeout(limite);
      socket.off(evento, oyente);
      resolver(datos);
    };
    socket.on(evento, oyente);
  });
}

beforeAll(async () => {
  servidor = createServer(app);
  io = iniciarTiempoReal(servidor);
  await new Promise<void>((resolver) => servidor.listen(0, resolver));
  url = `http://localhost:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await io.close();
});

describe('Tiempo real (WebSockets)', () => {
  it('rechaza la conexión con un token inválido', async () => {
    await expect(abrirSocket('token-falso')).rejects.toThrow('TOKEN_INVALIDO');
  });

  it('los visitantes reciben la existencia disponible al momento', async () => {
    const admin = await tokenAdmin();
    const producto = await nuevoProducto(admin, { existencia: 6 });
    const visitante = await abrirSocket();

    const evento = esperarEvento<{ variantes: { idVariante: number; disponible: number }[] }>(
      visitante,
      'inventario:existencia',
      (d) => d.variantes.some((v) => v.idVariante === producto.idVariante && v.disponible === 4),
    );
    await comprar(await nuevoCliente(), producto.idVariante, 2);
    await expect(evento).resolves.toBeDefined();
  });

  it('el personal recibe los pedidos nuevos y el dashboard se entera de la venta', async () => {
    const admin = await tokenAdmin();
    const socketAdmin = await abrirSocket(admin);
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();

    const pedidoNuevo = esperarEvento<{ idUsuario: number }>(socketAdmin, 'pedido:creado', (d) => d.idUsuario === cliente.idUsuario);
    const dashboard = esperarEvento(socketAdmin, 'dashboard:actualizar');
    await comprar(cliente, producto.idVariante, 1);

    await expect(pedidoNuevo).resolves.toMatchObject({ idUsuario: cliente.idUsuario });
    await expect(dashboard).resolves.toBeDefined();
  });

  it('el cliente recibe en vivo los cambios de estado de SU pedido y nadie más', async () => {
    const admin = await tokenAdmin();
    const operador = await tokenOperador();
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const [duenio, otro] = [await nuevoCliente(), await nuevoCliente()];
    const socketDuenio = await abrirSocket(duenio.token);
    const socketOtro = await abrirSocket(otro.token);
    const pedido = await comprar(duenio, producto.idVariante, 1);

    let otroRecibio = false;
    socketOtro.on('pedido:estado', () => (otroRecibio = true));
    const cambio = esperarEvento<{ idPedido: number; estadoNuevo: string }>(socketDuenio, 'pedido:estado', (d) => d.idPedido === pedido.idPedido);

    await api()
      .patch(`/api/pedidos/${pedido.idPedido}/estado`)
      .set('Authorization', `Bearer ${operador}`)
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    await expect(cambio).resolves.toMatchObject({ estadoAnterior: 'PAGADO', estadoNuevo: 'EN_PREPARACION' });
    await new Promise((r) => setTimeout(r, 300));
    expect(otroRecibio).toBe(false);
  });

  it('si un administrador desactiva al usuario, su socket recibe sesion:revocada y se cierra', async () => {
    const admin = await tokenAdmin();
    const cliente = await nuevoCliente('revocar');
    const socket = await abrirSocket(cliente.token);
    const revocada = esperarEvento(socket, 'sesion:revocada');
    const cerrado = new Promise((resolver) => socket.once('disconnect', resolver));

    await api().patch(`/api/usuarios/${cliente.idUsuario}/estado`).set('Authorization', `Bearer ${admin}`).send({ activo: false });

    await expect(revocada).resolves.toBeDefined();
    await expect(cerrado).resolves.toBeDefined();
  });
});
