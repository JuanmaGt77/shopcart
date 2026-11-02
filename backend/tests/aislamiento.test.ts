import { beforeAll, describe, expect, it } from 'vitest';
import {
  agregarAlCarrito,
  api,
  comprar,
  iniciarCheckout,
  nuevoCliente,
  nuevoProducto,
  tokenAdmin,
  type ClienteDePrueba,
} from './ayudantes.js';

/**
 * RF-01: "Cambiar el identificador de un pedido, carrito o dirección en la URL o en el
 * body no debe exponer ni modificar datos de otro cliente."
 */
describe('Aislamiento entre clientes (IDOR)', () => {
  let ana: ClienteDePrueba;
  let beto: ClienteDePrueba;
  let idPedidoDeAna: number;
  let idCheckoutDeAna: number;

  beforeAll(async () => {
    const admin = await tokenAdmin();
    const producto = await nuevoProducto(admin, { existencia: 20 });
    ana = await nuevoCliente('ana');
    beto = await nuevoCliente('beto');

    const pedido = await comprar(ana, producto.idVariante, 1);
    idPedidoDeAna = pedido.idPedido;

    await agregarAlCarrito(ana.token, producto.idVariante, 1);
    idCheckoutDeAna = (await iniciarCheckout(ana)).body.datos.idCheckout;
  });

  it('Beto no puede ver el pedido de Ana (403)', async () => {
    const respuesta = await api().get(`/api/pedidos/${idPedidoDeAna}`).set('Authorization', `Bearer ${beto.token}`);
    expect(respuesta.status).toBe(403);
    expect(JSON.stringify(respuesta.body)).not.toContain(ana.correo);
  });

  it('Beto no puede cancelar el pedido de Ana (403) y el pedido sigue intacto', async () => {
    const respuesta = await api()
      .post(`/api/pedidos/${idPedidoDeAna}/cancelar`)
      .set('Authorization', `Bearer ${beto.token}`)
      .send({ motivo: 'intento ajeno' });
    expect(respuesta.status).toBe(403);

    const pedido = await api().get(`/api/pedidos/${idPedidoDeAna}`).set('Authorization', `Bearer ${ana.token}`);
    expect(pedido.body.datos.estadoCodigo).toBe('PAGADO');
  });

  it('Beto no puede ver, editar, marcar ni borrar la dirección de Ana (403)', async () => {
    const ruta = `/api/direcciones/${ana.idDireccion}`;
    const auth = { Authorization: `Bearer ${beto.token}` };

    expect((await api().get(ruta).set(auth)).status).toBe(403);
    expect((await api().delete(ruta).set(auth)).status).toBe(403);
    expect((await api().patch(`${ruta}/predeterminada`).set(auth)).status).toBe(403);
    const edicion = await api().put(ruta).set(auth).send({
      alias: 'Hackeada',
      nombreDestinatario: 'Beto',
      telefono: '5555-0000',
      linea1: 'Otra',
      municipio: 'Mixco',
      idDepartamento: 7,
    });
    expect(edicion.status).toBe(403);

    const deAna = await api().get(ruta).set('Authorization', `Bearer ${ana.token}`);
    expect(deAna.body.datos.alias).toBe('Casa');
  });

  it('Beto no puede usar la dirección de Ana en su checkout (403)', async () => {
    const admin = await tokenAdmin();
    const producto = await nuevoProducto(admin, { existencia: 5 });
    await agregarAlCarrito(beto.token, producto.idVariante, 1);
    const respuesta = await iniciarCheckout({ ...beto, idDireccion: ana.idDireccion });
    expect(respuesta.status).toBe(403);
  });

  it('Beto no puede ver, pagar ni cancelar el checkout de Ana (403)', async () => {
    const auth = { Authorization: `Bearer ${beto.token}` };
    expect((await api().get(`/api/checkout/${idCheckoutDeAna}`).set(auth)).status).toBe(403);
    expect((await api().delete(`/api/checkout/${idCheckoutDeAna}`).set(auth)).status).toBe(403);
    const pago = await api()
      .post(`/api/checkout/${idCheckoutDeAna}/pagar`)
      .set(auth)
      .set('Idempotency-Key', 'intento-ajeno-1234')
      .send({ tarjeta: { numero: '4111111111111111', titular: 'Beto', expiracion: '12/30', cvv: '123' } });
    expect(pago.status).toBe(403);
  });

  it('el carrito no se identifica por ID: cada quien solo ve el suyo', async () => {
    const deAna = await api().get('/api/carrito').set('Authorization', `Bearer ${ana.token}`);
    const deBeto = await api().get('/api/carrito').set('Authorization', `Bearer ${beto.token}`);
    expect(deAna.body.datos.idCarrito).not.toBe(deBeto.body.datos.idCarrito);
  });

  it('mandar un idUsuario de otro en el body se rechaza (campos extra no permitidos)', async () => {
    const respuesta = await api()
      .post('/api/direcciones')
      .set('Authorization', `Bearer ${beto.token}`)
      .send({
        idUsuario: ana.idUsuario,
        alias: 'Truco',
        nombreDestinatario: 'Beto',
        telefono: '5555-0000',
        linea1: 'Calle',
        municipio: 'Mixco',
        idDepartamento: 7,
      });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('"Mis pedidos" solo trae los pedidos propios', async () => {
    const respuesta = await api().get('/api/pedidos/mios').set('Authorization', `Bearer ${beto.token}`);
    const ids = respuesta.body.datos.map((p: { idPedido: number }) => p.idPedido);
    expect(ids).not.toContain(idPedidoDeAna);
  });
});
