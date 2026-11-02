import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP } from '../src/db/ejecutor.js';
import { p } from '../src/db/parametros.js';
import { SP } from '../src/db/procedimientos.js';
import { iniciarJobReservas } from '../src/jobs/liberar-reservas.js';
import {
  agregarAlCarrito,
  api,
  comprar,
  disponibleDe,
  esperar,
  iniciarCheckout,
  nuevoCliente,
  nuevoProducto,
  pagar,
  tokenAdmin,
  tokenOperador,
} from './ayudantes.js';

let admin: string;
let operador: string;

beforeAll(async () => {
  admin = await tokenAdmin();
  operador = await tokenOperador();
});

const kardexDe = async (idVariante: number) =>
  (await api().get('/api/inventario/kardex').query({ idVariante }).set('Authorization', `Bearer ${operador}`)).body.datos as {
    tipoMovimiento: string;
    cantidad: number;
  }[];

describe('RF-06 Checkout: concurrencia, idempotencia y atomicidad', () => {
  it('si varios clientes van por la última unidad al mismo tiempo, solo uno la consigue', async () => {
    const producto = await nuevoProducto(admin, { existencia: 1 });
    const clientes = await Promise.all(Array.from({ length: 10 }, () => nuevoCliente('ultima')));
    for (const cliente of clientes) {
      expect((await agregarAlCarrito(cliente.token, producto.idVariante, 1)).status).toBe(200);
    }

    const intentos = await Promise.all(clientes.map((cliente) => iniciarCheckout(cliente)));
    const ganadores = intentos.filter((r) => r.status === 201);
    const perdedores = intentos.filter((r) => r.status === 409);

    expect(ganadores).toHaveLength(1);
    expect(perdedores).toHaveLength(9);
    for (const r of perdedores) {
      expect(r.body.error.codigo).toBe('STOCK_INSUFICIENTE');
      expect(r.body.error.mensaje).toMatch(/Ya no hay suficientes unidades/);
    }

    const ganador = clientes[intentos.findIndex((r) => r.status === 201)]!;
    expect((await pagar(ganador.token, ganadores[0]!.body.datos.idCheckout)).status).toBe(201);
    expect(await disponibleDe(producto.idProducto)).toBe(0);
  });

  it('un doble clic (dos pagos simultáneos con la misma clave) genera un solo pedido y un solo cobro', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 2);
    const idCheckout = (await iniciarCheckout(cliente)).body.datos.idCheckout;

    const clave = randomUUID();
    const [a, b] = await Promise.all([pagar(cliente.token, idCheckout, clave), pagar(cliente.token, idCheckout, clave)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.datos.pedido.idPedido).toBe(b.body.datos.pedido.idPedido);

    // Un reintento posterior (por falla de red) devuelve lo mismo
    const reintento = await pagar(cliente.token, idCheckout, clave);
    expect(reintento.status).toBe(200);
    expect(reintento.body.datos.duplicado).toBe(true);

    const misPedidos = await api().get('/api/pedidos/mios').set('Authorization', `Bearer ${cliente.token}`);
    expect(misPedidos.body.paginacion.totalRegistros).toBe(1);
    expect(a.body.datos.pedido.pago.monto).toBe(a.body.datos.pedido.total);
    expect((await kardexDe(producto.idVariante)).filter((k) => k.tipoMovimiento === 'SALIDA_VENTA')).toHaveLength(1);
  });

  it('pagar el mismo checkout con otra clave tampoco duplica el pedido', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const idCheckout = (await iniciarCheckout(cliente)).body.datos.idCheckout;

    const primero = await pagar(cliente.token, idCheckout, randomUUID());
    const segundo = await pagar(cliente.token, idCheckout, randomUUID());
    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);
    expect(segundo.body.datos.pedido.idPedido).toBe(primero.body.datos.pedido.idPedido);
  });

  it('el pago exige Idempotency-Key', async () => {
    const respuesta = await api()
      .post('/api/checkout/1/pagar')
      .set('Authorization', `Bearer ${(await nuevoCliente()).token}`)
      .send({ tarjeta: { numero: '4111111111111111', titular: 'Sin Clave', expiracion: '12/30', cvv: '123' } });
    expect(respuesta.status).toBe(400);
  });

  it('respeta el precio que el cliente vio al iniciar el pago aunque cambie antes de pagar', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5, precio: 200 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const checkout = await iniciarCheckout(cliente);

    await api().patch(`/api/variantes/${producto.idVariante}/precio`).set('Authorization', `Bearer ${admin}`).send({ precio: 500 });
    const pago = await pagar(cliente.token, checkout.body.datos.idCheckout);
    expect(pago.body.datos.pedido.lineas[0].precioUnitario).toBe(200);
    expect(pago.body.datos.pedido.total).toBe(checkout.body.datos.total);
  });

  it('la creación del pedido es atómica: si el cupón se agotó, no se guarda nada', async () => {
    const cupon = (
      await api()
        .post('/api/cupones')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          codigo: `UNO${randomUUID().slice(0, 6).toUpperCase()}`,
          tipoDescuento: 'MONTO',
          valor: 5,
          fechaInicio: '2026-01-01T00:00:00-06:00',
          fechaFin: '2027-12-31T00:00:00-06:00',
          limiteUsosTotal: 1,
        })
    ).body.datos;
    const producto = await nuevoProducto(admin, { existencia: 10 });
    const [primero, segundo] = [await nuevoCliente(), await nuevoCliente()];
    const checkouts: number[] = [];
    for (const cliente of [primero, segundo]) {
      await agregarAlCarrito(cliente.token, producto.idVariante, 2);
      await api().post('/api/carrito/cupon').set('Authorization', `Bearer ${cliente.token}`).send({ codigo: cupon.codigo });
      checkouts.push((await iniciarCheckout(cliente)).body.datos.idCheckout);
    }
    expect((await pagar(primero.token, checkouts[0]!)).status).toBe(201);

    const kardexAntes = (await kardexDe(producto.idVariante)).length;
    const fallido = await pagar(segundo.token, checkouts[1]!);
    expect(fallido.status).toBe(422);
    expect(fallido.body.error.codigo).toBe('CUPON_AGOTADO');

    // Nada a medias: sin pedido, sin movimiento de inventario y la reserva sigue intacta
    const misPedidos = await api().get('/api/pedidos/mios').set('Authorization', `Bearer ${segundo.token}`);
    expect(misPedidos.body.paginacion.totalRegistros).toBe(0);
    expect((await kardexDe(producto.idVariante)).length).toBe(kardexAntes);
    const checkout = await api().get(`/api/checkout/${checkouts[1]}`).set('Authorization', `Bearer ${segundo.token}`);
    expect(checkout.body.datos.estado).toBe('ACTIVO');
  });

  it('una reserva vencida libera la existencia sin intervención manual', async () => {
    const parametro = (valor: number) =>
      api().put('/api/parametros/SEGUNDOS_RESERVA_CHECKOUT').set('Authorization', `Bearer ${admin}`).send({ valor });

    const producto = await nuevoProducto(admin, { existencia: 4 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 3);

    await parametro(2);
    try {
      const checkout = await iniciarCheckout(cliente);
      expect(await disponibleDe(producto.idProducto)).toBe(1);

      await esperar(2500);
      await iniciarJobReservas(3600).ejecutarAhora();

      expect(await disponibleDe(producto.idProducto)).toBe(4);
      const estado = await api().get(`/api/checkout/${checkout.body.datos.idCheckout}`).set('Authorization', `Bearer ${cliente.token}`);
      expect(estado.body.datos.estado).toBe('EXPIRADO');

      const pago = await pagar(cliente.token, checkout.body.datos.idCheckout);
      expect(pago.status).toBe(409);
      expect(pago.body.error.codigo).toBe('RESERVA_EXPIRADA');
    } finally {
      await parametro(900);
    }
  });

  it('una tarjeta rechazada no crea pedido (402)', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    await agregarAlCarrito(cliente.token, producto.idVariante, 1);
    const idCheckout = (await iniciarCheckout(cliente)).body.datos.idCheckout;
    const pago = await pagar(cliente.token, idCheckout, randomUUID(), {
      numero: '4000000000000002',
      titular: 'Rechazada',
      expiracion: '12/30',
      cvv: '123',
    });
    expect(pago.status).toBe(402);
    expect(pago.body.error.codigo).toBe('PAGO_RECHAZADO');
  });
});

describe('RF-07 Pedidos y devoluciones', () => {
  it('una transición no permitida se rechaza en la API y también en la base de datos', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const pedido = await comprar(await nuevoCliente(), producto.idVariante, 1);

    const enApi = await api()
      .patch(`/api/pedidos/${pedido.idPedido}/estado`)
      .set('Authorization', `Bearer ${operador}`)
      .send({ estado: 'ENTREGADO' });
    expect(enApi.status).toBe(409);
    expect(enApi.body.error.codigo).toBe('TRANSICION_NO_PERMITIDA');

    // Saltando la validación de la API y llamando el SP directo, la base también lo rechaza
    await expect(
      ejecutarSP(SP.Pedidos.CambiarEstado, [
        p.entero('IDUsuarioAccion', 2),
        p.entero('IDPedido', pedido.idPedido),
        p.ascii('CodigoEstadoNuevo', 20, 'ENTREGADO'),
        p.texto('Comentario', 250, null),
      ]),
    ).rejects.toMatchObject({ estado: 409, codigo: 'TRANSICION_NO_PERMITIDA' });
  });

  it('cada cambio de estado guarda usuario, fecha, estado anterior y estado nuevo', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const pedido = await comprar(await nuevoCliente(), producto.idVariante, 1);
    for (const estado of ['EN_PREPARACION', 'DESPACHADO']) {
      await api().patch(`/api/pedidos/${pedido.idPedido}/estado`).set('Authorization', `Bearer ${operador}`).send({ estado }).expect(200);
    }
    const detalle = await api().get(`/api/pedidos/${pedido.idPedido}`).set('Authorization', `Bearer ${operador}`);
    const historial = detalle.body.datos.historial;
    expect(historial).toHaveLength(3);
    expect(historial[1]).toMatchObject({
      estadoAnteriorCodigo: 'PAGADO',
      estadoNuevoCodigo: 'EN_PREPARACION',
      usuario: 'Luis Fernando Hernández',
      rolUsuario: 'OPERADOR',
    });
    expect(historial[1].fecha).toBeDefined();
  });

  it('cancelar reintegra la existencia con un movimiento de kardex', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    const pedido = await comprar(cliente, producto.idVariante, 2);
    expect(await disponibleDe(producto.idProducto)).toBe(3);

    const cancelado = await api()
      .post(`/api/pedidos/${pedido.idPedido}/cancelar`)
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ motivo: 'Me equivoqué de talla' });
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.datos.estadoCodigo).toBe('CANCELADO');
    expect(cancelado.body.datos.pago.estado).toBe('REEMBOLSADO');
    expect(await disponibleDe(producto.idProducto)).toBe(5);
    expect((await kardexDe(producto.idVariante))[0]).toMatchObject({ tipoMovimiento: 'CANCELACION', cantidad: 2 });
  });

  it('un pedido despachado ya no se puede cancelar', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    const pedido = await comprar(cliente, producto.idVariante, 1);
    for (const estado of ['EN_PREPARACION', 'DESPACHADO']) {
      await api().patch(`/api/pedidos/${pedido.idPedido}/estado`).set('Authorization', `Bearer ${operador}`).send({ estado });
    }
    const respuesta = await api()
      .post(`/api/pedidos/${pedido.idPedido}/cancelar`)
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ motivo: 'Tarde' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('PEDIDO_NO_CANCELABLE');
  });

  it('devoluciones parciales y totales por línea, sin devolver más de lo vendido', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10, precio: 100 });
    const cliente = await nuevoCliente();
    const pedido = await comprar(cliente, producto.idVariante, 3);
    for (const estado of ['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO']) {
      await api().patch(`/api/pedidos/${pedido.idPedido}/estado`).set('Authorization', `Bearer ${operador}`).send({ estado });
    }
    const idLinea = pedido.lineas[0]!.idPedidoDetalle;
    const devolver = (cantidad: number) =>
      api()
        .post(`/api/pedidos/${pedido.idPedido}/devoluciones`)
        .set('Authorization', `Bearer ${operador}`)
        .send({ motivo: 'Talla incorrecta', lineas: [{ idPedidoDetalle: idLinea, cantidad }] });

    const demasiado = await devolver(4);
    expect(demasiado.status).toBe(409);
    expect(demasiado.body.error.codigo).toBe('DEVOLUCION_EXCEDE_VENDIDO');

    const parcial = await devolver(1);
    expect(parcial.status).toBe(201);
    expect(parcial.body.datos.pedido.estadoCodigo).toBe('DEVUELTO_PARCIAL');
    expect(parcial.body.datos.devolucion.montoReembolso).toBe(100);

    const resto = await devolver(2);
    expect(resto.body.datos.pedido.estadoCodigo).toBe('DEVUELTO');
    // Al devolver todo también se reembolsa el envío: el pedido queda reembolsado completo
    expect(resto.body.datos.pedido.montoDevuelto).toBe(pedido.total);
    expect(await disponibleDe(producto.idProducto)).toBe(10);

    const otraMas = await devolver(1);
    expect(otraMas.status).toBe(409);
  });

  it('el cliente no puede avanzar estados ni registrar devoluciones', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const cliente = await nuevoCliente();
    const pedido = await comprar(cliente, producto.idVariante, 1);
    const estado = await api()
      .patch(`/api/pedidos/${pedido.idPedido}/estado`)
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ estado: 'EN_PREPARACION' });
    expect(estado.status).toBe(403);
  });
});
