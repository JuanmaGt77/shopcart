import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  agregarAlCarrito,
  api,
  iniciarCheckout,
  nuevoCliente,
  nuevoProducto,
  pagar,
  tokenAdmin,
} from './ayudantes.js';

let admin: string;

beforeAll(async () => {
  admin = await tokenAdmin();
});

async function crearCupon(datos: Record<string, unknown>) {
  const respuesta = await api()
    .post('/api/cupones')
    .set('Authorization', `Bearer ${admin}`)
    .send({
      codigo: `T${randomUUID().slice(0, 8).toUpperCase()}`,
      tipoDescuento: 'PORCENTAJE',
      valor: 10,
      fechaInicio: '2026-01-01T00:00:00-06:00',
      fechaFin: '2027-12-31T23:59:59-06:00',
      ...datos,
    });
  if (respuesta.status !== 201) throw new Error(respuesta.text);
  return respuesta.body.datos as { idCupon: number; codigo: string };
}

describe('RF-04 Carrito', () => {
  it('no se puede agregar más cantidad que la existencia disponible', async () => {
    const producto = await nuevoProducto(admin, { existencia: 3 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 2).then((r) => expect(r.status).toBe(200));
    const exceso = await agregarAlCarrito(cliente.token, producto.idVariante, 2);
    expect(exceso.status).toBe(409);
    expect(exceso.body.error.codigo).toBe('CANTIDAD_EXCEDE_DISPONIBLE');
    expect(exceso.body.error.mensaje).toContain('Solo hay 3 unidades');
  });

  it('agrega, modifica y elimina productos, y calcula subtotal, descuento y total', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10, precio: 50 });
    const cliente = await nuevoCliente();
    const auth = { Authorization: `Bearer ${cliente.token}` };

    await agregarAlCarrito(cliente.token, producto.idVariante, 2);
    const modificado = await api().patch(`/api/carrito/items/${producto.idVariante}`).set(auth).send({ cantidad: 5 });
    expect(modificado.body.datos).toMatchObject({ cantidadArticulos: 5, subtotal: 250, descuento: 0, total: 250 });

    const eliminado = await api().delete(`/api/carrito/items/${producto.idVariante}`).set(auth);
    expect(eliminado.body.datos).toMatchObject({ cantidadArticulos: 0, total: 0 });
  });

  it('el total no tiene errores de redondeo (3 x Q33.33 con 10 % = Q89.99 exactos)', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10, precio: 33.33 });
    const cupon = await crearCupon({ valor: 10 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 3);
    const carrito = await api()
      .post('/api/carrito/cupon')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ codigo: cupon.codigo });

    // 99.99 * 10 % = 9.999 -> 10.00 ; 99.99 - 10.00 = 89.99 (en JavaScript 0.1 + 0.2 no daría exacto)
    expect(carrito.body.datos).toMatchObject({ subtotal: 99.99, descuento: 10, total: 89.99 });
  });

  it('un invitado arma su carrito con un token y al iniciar sesión se fusiona', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10 });
    const invitado = await api().post('/api/carrito/items').send({ idVariante: producto.idVariante, cantidad: 2 });
    expect(invitado.status).toBe(200);
    const token = invitado.body.datos.tokenInvitado as string;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);

    const mismo = await api().get('/api/carrito').set('X-Carrito-Token', token);
    expect(mismo.body.datos.cantidadArticulos).toBe(2);

    const cliente = await nuevoCliente();
    const fusion = await api()
      .post('/api/carrito/fusionar')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ tokenInvitado: token });
    expect(fusion.body.datos.cantidadArticulos).toBe(2);
    expect(fusion.body.datos.esInvitado).toBe(false);

    const vacio = await api().get('/api/carrito').set('X-Carrito-Token', token);
    expect(vacio.body.datos.cantidadArticulos).toBe(0);
  });

  it('el personal no compra con su cuenta de trabajo', async () => {
    const producto = await nuevoProducto(admin, { existencia: 1 });
    const respuesta = await agregarAlCarrito(admin, producto.idVariante, 1);
    expect(respuesta.status).toBe(403);
  });
});

describe('RF-05 Cupones', () => {
  it('un cupón vencido, agotado, no vigente o sin el mínimo se rechaza con un mensaje específico', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10, precio: 60 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const aplicar = (codigo: string) =>
      api().post('/api/carrito/cupon').set('Authorization', `Bearer ${cliente.token}`).send({ codigo });

    const casos: [string, string, RegExp][] = [
      ['VERANO2025', 'CUPON_VENCIDO', /venció el/],
      ['AGOTADO5', 'CUPON_AGOTADO', /se agotó/],
      ['BLACKFRIDAY25', 'CUPON_NO_VIGENTE', /todavía no está vigente/],
      ['BIENVENIDA10', 'CUPON_MONTO_MINIMO', /compra mínima de Q100\.00\. Te faltan Q40\.00/],
      ['PAUSADO10', 'CUPON_INACTIVO', /no está disponible/],
      ['CALZADO15', 'CUPON_SIN_PRODUCTOS_ELEGIBLES', /solo aplica a productos de la categoría Calzado/],
      ['NOEXISTE99', 'CUPON_NO_EXISTE', /no existe/],
    ];
    for (const [codigo, error, mensaje] of casos) {
      const respuesta = await aplicar(codigo);
      expect(respuesta.body.error?.codigo, codigo).toBe(error);
      expect(respuesta.body.error.mensaje, codigo).toMatch(mensaje);
    }
  });

  it('un descuento nunca deja el total por debajo de cero', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5, precio: 119 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const carrito = await api()
      .post('/api/carrito/cupon')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ codigo: 'DEMO500' });
    expect(carrito.body.datos).toMatchObject({ subtotal: 119, descuento: 119, total: 0 });

    const checkout = await iniciarCheckout(cliente, 1);
    expect(checkout.body.datos).toMatchObject({ subtotal: 119, descuento: 119, costoEnvio: 35, total: 35 });
  });

  it('un cupón por categoría solo descuenta los productos de esa categoría', async () => {
    const calzado = await nuevoProducto(admin, { existencia: 5, precio: 200, idCategoria: 4 });
    const playera = await nuevoProducto(admin, { existencia: 5, precio: 100, idCategoria: 1 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, calzado.idVariante, 1);
    await agregarAlCarrito(cliente.token, playera.idVariante, 1);
    const carrito = await api()
      .post('/api/carrito/cupon')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ codigo: 'CALZADO15' });
    expect(carrito.body.datos).toMatchObject({ subtotal: 300, descuento: 30, total: 270 });
  });

  it('respeta el límite de usos por cliente', async () => {
    const cupon = await crearCupon({ limiteUsosPorCliente: 1 });
    const producto = await nuevoProducto(admin, { existencia: 10 });
    const cliente = await nuevoCliente();

    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    await api().post('/api/carrito/cupon').set('Authorization', `Bearer ${cliente.token}`).send({ codigo: cupon.codigo });
    const checkout = await iniciarCheckout(cliente);
    await pagar(cliente.token, checkout.body.datos.idCheckout).then((r) => expect(r.status).toBe(201));

    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const segundo = await api()
      .post('/api/carrito/cupon')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ codigo: cupon.codigo });
    expect(segundo.body.error.codigo).toBe('CUPON_LIMITE_CLIENTE');
  });

  it('el límite total de usos se respeta aunque muchos clientes paguen al mismo tiempo', async () => {
    const limite = 3;
    const cupon = await crearCupon({ limiteUsosTotal: limite });
    const producto = await nuevoProducto(admin, { existencia: 50 });

    // 8 clientes con el cupón aplicado y su checkout listo
    const clientes = await Promise.all(Array.from({ length: 8 }, () => nuevoCliente('cupon')));
    const checkouts: number[] = [];
    for (const cliente of clientes) {
      await agregarAlCarrito(cliente.token, producto.idVariante, 1);
      await api().post('/api/carrito/cupon').set('Authorization', `Bearer ${cliente.token}`).send({ codigo: cupon.codigo });
      checkouts.push((await iniciarCheckout(cliente)).body.datos.idCheckout);
    }

    // Todos pagan a la vez
    const pagos = await Promise.all(clientes.map((cliente, i) => pagar(cliente.token, checkouts[i]!)));
    const exitosos = pagos.filter((p) => p.status === 201);
    const agotados = pagos.filter((p) => p.body.error?.codigo === 'CUPON_AGOTADO');

    expect(exitosos).toHaveLength(limite);
    expect(agotados).toHaveLength(clientes.length - limite);

    const usos = await api().get(`/api/cupones/${cupon.idCupon}`).set('Authorization', `Bearer ${admin}`);
    expect(usos.body.datos).toMatchObject({ usosActuales: limite, estado: 'AGOTADO' });
  });
});
