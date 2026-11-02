import { beforeAll, describe, expect, it } from 'vitest';
import { api, comprar, nuevoCliente, nuevoProducto, tokenAdmin, tokenOperador } from './ayudantes.js';

let admin: string;
let operador: string;
const hoy = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10); // día de Guatemala

beforeAll(async () => {
  admin = await tokenAdmin();
  operador = await tokenOperador();
});

async function resumenDeHoy() {
  const respuesta = await api()
    .get('/api/reportes/resumen')
    .query({ desde: hoy, hasta: hoy })
    .set('Authorization', `Bearer ${admin}`);
  return respuesta.body.datos as { ventasNetas: number; pedidos: number; ticketPromedio: number };
}

const redondear = (n: number) => Math.round(n * 100) / 100;

describe('RF-08 Dashboard y reportes', () => {
  it('solo cuentan pedidos no cancelados y siempre netos de devoluciones', async () => {
    const producto = await nuevoProducto(admin, { existencia: 20, precio: 100 });
    const inicial = await resumenDeHoy();

    // Un pedido nuevo suma
    const cliente = await nuevoCliente();
    const pedidoA = await comprar(cliente, producto.idVariante, 2);
    const conA = await resumenDeHoy();
    expect(conA.pedidos).toBe(inicial.pedidos + 1);
    expect(conA.ventasNetas).toBe(redondear(inicial.ventasNetas + pedidoA.total));

    // Cancelado deja de contar
    await api()
      .post(`/api/pedidos/${pedidoA.idPedido}/cancelar`)
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ motivo: 'Prueba de reportes' })
      .expect(200);
    expect(await resumenDeHoy()).toMatchObject({ pedidos: inicial.pedidos, ventasNetas: inicial.ventasNetas });

    // Con devolución parcial cuenta solo lo neto
    const pedidoB = await comprar(cliente, producto.idVariante, 3);
    for (const estado of ['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO']) {
      await api().patch(`/api/pedidos/${pedidoB.idPedido}/estado`).set('Authorization', `Bearer ${operador}`).send({ estado });
    }
    const devolucion = await api()
      .post(`/api/pedidos/${pedidoB.idPedido}/devoluciones`)
      .set('Authorization', `Bearer ${operador}`)
      .send({ motivo: 'Defecto', lineas: [{ idPedidoDetalle: pedidoB.lineas[0]!.idPedidoDetalle, cantidad: 1 }] });
    const reembolso = devolucion.body.datos.devolucion.montoReembolso as number;

    const final = await resumenDeHoy();
    expect(final.pedidos).toBe(inicial.pedidos + 1);
    expect(final.ventasNetas).toBe(redondear(inicial.ventasNetas + pedidoB.total - reembolso));
  });

  it('ventas por día, semana y mes en quetzales y número de pedidos', async () => {
    for (const agrupacion of ['dia', 'semana', 'mes']) {
      const respuesta = await api()
        .get('/api/reportes/ventas')
        .query({ agrupacion, desde: '2026-08-01', hasta: hoy })
        .set('Authorization', `Bearer ${admin}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos.length).toBeGreaterThan(0);
      expect(respuesta.body.datos[0]).toEqual(
        expect.objectContaining({ periodo: expect.any(String), pedidos: expect.any(Number), montoVendido: expect.any(Number) }),
      );
    }
    const meses = await api()
      .get('/api/reportes/ventas')
      .query({ agrupacion: 'mes', desde: '2026-08-01', hasta: '2026-10-31' })
      .set('Authorization', `Bearer ${admin}`);
    expect(meses.body.datos.map((m: { periodo: string }) => m.periodo)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('ventas por categoría y los 10 productos más vendidos', async () => {
    const categorias = await api().get('/api/reportes/ventas-por-categoria').set('Authorization', `Bearer ${admin}`);
    expect(categorias.body.datos.length).toBeGreaterThan(0);
    const porcentajes = categorias.body.datos.reduce((s: number, c: { porcentaje: number }) => s + c.porcentaje, 0);
    expect(Math.round(porcentajes)).toBe(100);

    const top = await api().get('/api/reportes/top-productos').set('Authorization', `Bearer ${admin}`);
    expect(top.body.datos).toHaveLength(10);
    const unidades = top.body.datos.map((t: { unidades: number }) => t.unidades);
    expect([...unidades].sort((a, b) => b - a)).toEqual(unidades);
  });

  it('carritos abandonados según las horas configuradas', async () => {
    const respuesta = await api().get('/api/reportes/carritos-abandonados').set('Authorization', `Bearer ${admin}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.paginacion.totalRegistros).toBeGreaterThan(0);
    expect(respuesta.body.datos[0].horasInactivo).toBeGreaterThanOrEqual(24);
  });

  it('el listado de pedidos filtra por estado, cliente y fechas con paginación del servidor', async () => {
    const respuesta = await api()
      .get('/api/pedidos')
      .query({ estado: 'ENTREGADO', cliente: 'maria', desde: '2026-08-01', hasta: hoy, tamanoPagina: 5 })
      .set('Authorization', `Bearer ${operador}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.length).toBeLessThanOrEqual(5);
    for (const pedido of respuesta.body.datos) {
      expect(pedido.estadoCodigo).toBe('ENTREGADO');
      expect(pedido.correoCliente).toContain('maria');
    }
  });

  it('los reportes usan caché y se invalida cuando hay una venta nueva', async () => {
    const pedir = () => api().get('/api/reportes/top-productos').query({ limite: 5 }).set('Authorization', `Bearer ${admin}`);
    await pedir();
    expect((await pedir()).headers['x-cache']).toBe('HIT');

    const producto = await nuevoProducto(admin, { existencia: 5 });
    await comprar(await nuevoCliente(), producto.idVariante, 1);
    expect((await pedir()).headers['x-cache']).toBe('MISS');
  });

  it('los listados y reportes principales responden en menos de 1 segundo', async () => {
    const rutas: [string, string][] = [
      ['/api/productos?q=playera&ordenarPor=precio', ''],
      ['/api/pedidos?tamanoPagina=50', operador],
      ['/api/inventario/existencias?bajoStock=true', operador],
      ['/api/inventario/kardex?tamanoPagina=50', operador],
      ['/api/bitacora?tamanoPagina=50', admin],
      ['/api/reportes/ventas?agrupacion=dia&desde=2026-08-01', admin],
      ['/api/reportes/ventas-por-categoria?desde=2026-08-01', admin],
    ];
    for (const [ruta, token] of rutas) {
      const inicio = performance.now();
      const solicitud = api().get(ruta);
      const respuesta = await (token ? solicitud.set('Authorization', `Bearer ${token}`) : solicitud);
      const ms = performance.now() - inicio;
      expect(respuesta.status, ruta).toBe(200);
      expect(ms, `${ruta} tardó ${ms.toFixed(0)} ms`).toBeLessThan(1000);
    }
  });
});

describe('RF-09 Bitácora', () => {
  it('registra cambios de estado de pedidos con usuario, valor anterior y nuevo', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const pedido = await comprar(await nuevoCliente(), producto.idVariante, 1);
    await api().patch(`/api/pedidos/${pedido.idPedido}/estado`).set('Authorization', `Bearer ${operador}`).send({ estado: 'EN_PREPARACION' });

    const respuesta = await api()
      .get('/api/bitacora')
      .query({ modulo: 'PEDIDOS', idEntidad: String(pedido.idPedido), accion: 'CAMBIO_ESTADO' })
      .set('Authorization', `Bearer ${admin}`);
    expect(respuesta.body.datos[0]).toMatchObject({
      entidad: 'Pedido',
      valorAnterior: { estado: 'PAGADO' },
      valorNuevo: { estado: 'EN_PREPARACION' },
      correoUsuario: 'operador@shopcart.test',
    });
  });

  it('registra la creación de productos, cupones y los ajustes de existencia', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    await api()
      .post('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${operador}`)
      .send({ idVariante: producto.idVariante, tipo: 'ENTRADA_COMPRA', cantidad: 10, motivo: 'Compra a proveedor' });

    const catalogo = await api()
      .get('/api/bitacora')
      .query({ modulo: 'CATALOGO', entidad: 'Producto', idEntidad: String(producto.idProducto) })
      .set('Authorization', `Bearer ${admin}`);
    expect(catalogo.body.datos[0].accion).toBe('CREAR');

    const inventario = await api()
      .get('/api/bitacora')
      .query({ modulo: 'INVENTARIO', idEntidad: String(producto.idVariante) })
      .set('Authorization', `Bearer ${admin}`);
    expect(inventario.body.datos[0]).toMatchObject({
      accion: 'CAMBIO_EXISTENCIA',
      valorAnterior: { existencia: 5 },
      valorNuevo: { existencia: 15 },
    });
  });

  it('no existe forma de modificar ni eliminar la bitácora desde la API', async () => {
    for (const metodo of ['put', 'patch', 'delete'] as const) {
      const respuesta = await api()[metodo]('/api/bitacora/1').set('Authorization', `Bearer ${admin}`);
      expect(respuesta.status).toBe(404);
    }
  });

  it('solo el administrador puede consultarla', async () => {
    const respuesta = await api().get('/api/bitacora').set('Authorization', `Bearer ${operador}`);
    expect(respuesta.status).toBe(403);
  });
});
