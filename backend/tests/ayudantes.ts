import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { crearApp } from '../src/app.js';

/** App real con límites de login altos (las pruebas inician sesión muchas veces). */
export const app = crearApp({ limiteLogin: 10_000, limiteRegistro: 10_000 });

export const CREDENCIALES = {
  admin: { correo: 'admin@shopcart.test', contrasena: 'Admin123!' },
  operador: { correo: 'operador@shopcart.test', contrasena: 'Operador123!' },
  cliente: { correo: 'cliente@shopcart.test', contrasena: 'Cliente123!' },
} as const;

export const TARJETA_OK = { numero: '4111111111111111', titular: 'Cliente de Prueba', expiracion: '12/30', cvv: '123' };

export const api = () => request(app);

export async function iniciarSesion(correo: string, contrasena: string): Promise<string> {
  const respuesta = await api().post('/api/auth/login').send({ correo, contrasena });
  if (respuesta.status !== 200) throw new Error(`No se pudo iniciar sesión con ${correo}: ${respuesta.text}`);
  return respuesta.body.datos.accessToken as string;
}

export const tokenAdmin = () => iniciarSesion(CREDENCIALES.admin.correo, CREDENCIALES.admin.contrasena);
export const tokenOperador = () => iniciarSesion(CREDENCIALES.operador.correo, CREDENCIALES.operador.contrasena);

export interface ClienteDePrueba {
  token: string;
  idUsuario: number;
  correo: string;
  idDireccion: number;
}

/** Registra un cliente nuevo (correo único) con una dirección lista para comprar. */
export async function nuevoCliente(prefijo = 'cliente'): Promise<ClienteDePrueba> {
  const correo = `${prefijo}.${randomUUID().slice(0, 8)}@pruebas.test`;
  const registro = await api()
    .post('/api/auth/registro')
    .send({ correo, contrasena: 'Prueba123!', nombres: 'Cliente', apellidos: 'De Prueba' });
  if (registro.status !== 201) throw new Error(`Registro falló: ${registro.text}`);
  const token = registro.body.datos.accessToken as string;

  const direccion = await api()
    .post('/api/direcciones')
    .set('Authorization', `Bearer ${token}`)
    .send({
      alias: 'Casa',
      nombreDestinatario: 'Cliente De Prueba',
      telefono: '5555-1234',
      linea1: '6a. avenida 1-23',
      zona: 10,
      municipio: 'Guatemala',
      idDepartamento: 7,
    });
  if (direccion.status !== 201) throw new Error(`No se pudo crear la dirección: ${direccion.text}`);

  return { token, idUsuario: registro.body.datos.usuario.idUsuario, correo, idDireccion: direccion.body.datos.idDireccion };
}

export interface ProductoDePrueba {
  idProducto: number;
  idVariante: number;
  sku: string;
}

/** Crea (como admin) un producto con una sola variante y la existencia indicada. */
export async function nuevoProducto(
  admin: string,
  opciones: { existencia: number; precio?: number; idCategoria?: number },
): Promise<ProductoDePrueba> {
  const sku = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const respuesta = await api()
    .post('/api/productos')
    .set('Authorization', `Bearer ${admin}`)
    .send({
      idCategoria: opciones.idCategoria ?? 1,
      nombre: `Producto de prueba ${sku}`,
      variantes: [{ sku, precio: opciones.precio ?? 100, existenciaInicial: opciones.existencia, atributos: { Talla: 'M' } }],
    });
  if (respuesta.status !== 201) throw new Error(`No se pudo crear el producto: ${respuesta.text}`);
  return {
    idProducto: respuesta.body.datos.idProducto,
    idVariante: respuesta.body.datos.variantes[0].idVariante,
    sku,
  };
}

export async function agregarAlCarrito(token: string, idVariante: number, cantidad: number) {
  return api().post('/api/carrito/items').set('Authorization', `Bearer ${token}`).send({ idVariante, cantidad });
}

export async function iniciarCheckout(cliente: ClienteDePrueba, idMetodoEnvio = 1) {
  return api()
    .post('/api/checkout')
    .set('Authorization', `Bearer ${cliente.token}`)
    .send({ idDireccion: cliente.idDireccion, idMetodoEnvio });
}

export async function pagar(token: string, idCheckout: number, clave = randomUUID(), tarjeta = TARJETA_OK) {
  return api()
    .post(`/api/checkout/${idCheckout}/pagar`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', clave)
    .send({ tarjeta });
}

/** Compra completa: carrito -> checkout -> pago. Devuelve el pedido creado. */
export async function comprar(cliente: ClienteDePrueba, idVariante: number, cantidad = 1) {
  const carrito = await agregarAlCarrito(cliente.token, idVariante, cantidad);
  if (carrito.status !== 200) throw new Error(`Carrito: ${carrito.text}`);
  const checkout = await iniciarCheckout(cliente);
  if (checkout.status !== 201) throw new Error(`Checkout: ${checkout.text}`);
  const pago = await pagar(cliente.token, checkout.body.datos.idCheckout);
  if (pago.status !== 201) throw new Error(`Pago: ${pago.text}`);
  return pago.body.datos.pedido as { idPedido: number; numeroPedido: string; total: number; lineas: { idPedidoDetalle: number }[] };
}

export async function disponibleDe(idProducto: number): Promise<number> {
  const respuesta = await api().get(`/api/productos/${idProducto}`);
  return respuesta.body.datos.variantes[0].disponible as number;
}

export const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
