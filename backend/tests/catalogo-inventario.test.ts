import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, comprar, nuevoCliente, nuevoProducto, tokenAdmin, tokenOperador } from './ayudantes.js';

let admin: string;
let operador: string;

beforeAll(async () => {
  admin = await tokenAdmin();
  operador = await tokenOperador();
});

describe('RF-02 Catálogo', () => {
  it('busca por texto con filtros, orden y paginación del lado del servidor', async () => {
    const respuesta = await api().get('/api/productos').query({
      q: 'playera',
      precioMin: 80,
      precioMax: 200,
      ordenarPor: 'precio',
      direccion: 'asc',
      tamanoPagina: 3,
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.length).toBeLessThanOrEqual(3);
    expect(respuesta.body.paginacion.totalRegistros).toBeGreaterThan(0);
    const precios = respuesta.body.datos.map((p: { precioMinimo: number }) => p.precioMinimo);
    expect([...precios].sort((a, b) => a - b)).toEqual(precios);
  });

  it('los comodines de LIKE que escribe el usuario se buscan como texto literal', async () => {
    // Sin escapar, "_" coincidiría con cualquier producto; escapado solo busca un guion bajo real
    const guionBajo = await api().get('/api/productos').query({ q: '_' });
    expect(guionBajo.status).toBe(200);
    expect(guionBajo.body.paginacion.totalRegistros).toBe(0);

    // "%" solo encuentra el producto que de verdad tiene un % en su descripción ("100 % algodón")
    const porcentaje = await api().get('/api/productos').query({ q: '%' });
    expect(porcentaje.body.paginacion.totalRegistros).toBe(1);
    expect(porcentaje.body.datos[0].descripcion).toContain('100 %');
  });

  it('crea un producto con varias variantes y su existencia inicial entra al kardex', async () => {
    const base = randomUUID().slice(0, 6).toUpperCase();
    const respuesta = await api()
      .post('/api/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        idCategoria: 1,
        nombre: `Playera de prueba ${base}`,
        imagenes: [{ url: 'https://picsum.photos/seed/prueba/400/400' }],
        variantes: [
          { sku: `PR-${base}-S`, precio: 89.5, existenciaInicial: 10, atributos: { Talla: 'S', Color: 'Negro' } },
          { sku: `PR-${base}-M`, precio: 89.5, existenciaInicial: 4, atributos: { Talla: 'M', Color: 'Negro' } },
        ],
      });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.variantes).toHaveLength(2);

    const idVariante = respuesta.body.datos.variantes.find((v: { sku: string }) => v.sku === `PR-${base}-S`).idVariante;
    const kardex = await api()
      .get('/api/inventario/kardex')
      .query({ idVariante })
      .set('Authorization', `Bearer ${operador}`);
    expect(kardex.body.datos[0]).toMatchObject({ tipoMovimiento: 'ENTRADA_COMPRA', cantidad: 10, existenciaNueva: 10 });
  });

  it('no permite dos variantes con el mismo SKU ni crear productos si no es administrador', async () => {
    const duplicado = await api()
      .post('/api/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ idCategoria: 1, nombre: 'Duplicado', variantes: [{ sku: 'PLABAS-NEG-M', precio: 10 }] });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.codigo).toBe('SKU_DUPLICADO');

    const cliente = await nuevoCliente();
    const sinPermiso = await api()
      .post('/api/productos')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ idCategoria: 1, nombre: 'X', variantes: [{ sku: 'X-1-2', precio: 10 }] });
    expect(sinPermiso.status).toBe(403);
  });

  it('un producto con ventas no se borra: se desactiva y deja de verse en la tienda', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    await comprar(await nuevoCliente(), producto.idVariante, 1);

    const eliminar = await api().delete(`/api/productos/${producto.idProducto}`).set('Authorization', `Bearer ${admin}`);
    expect(eliminar.status).toBe(200);
    expect(eliminar.body.datos.resultado).toBe('DESACTIVADO');

    expect((await api().get(`/api/productos/${producto.idProducto}`)).status).toBe(404);
    const busqueda = await api().get('/api/productos').query({ q: producto.sku });
    expect(busqueda.body.paginacion.totalRegistros).toBe(0);
  });

  it('un producto sin historia sí se elimina físicamente', async () => {
    const producto = await nuevoProducto(admin, { existencia: 0 });
    const eliminar = await api().delete(`/api/productos/${producto.idProducto}`).set('Authorization', `Bearer ${admin}`);
    expect(eliminar.body.datos.resultado).toBe('ELIMINADO');
  });

  it('un cambio de precio no altera el monto de los pedidos ya realizados y queda en bitácora', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5, precio: 150 });
    const cliente = await nuevoCliente();
    const pedido = await comprar(cliente, producto.idVariante, 2);

    await api()
      .patch(`/api/variantes/${producto.idVariante}/precio`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ precio: 999.99 })
      .expect(200);

    const despues = await api().get(`/api/pedidos/${pedido.idPedido}`).set('Authorization', `Bearer ${cliente.token}`);
    expect(despues.body.datos.lineas[0].precioUnitario).toBe(150);
    expect(despues.body.datos.total).toBe(pedido.total);

    const bitacora = await api()
      .get('/api/bitacora')
      .query({ entidad: 'Variante', idEntidad: String(producto.idVariante), accion: 'CAMBIO_PRECIO' })
      .set('Authorization', `Bearer ${admin}`);
    expect(bitacora.body.datos[0]).toMatchObject({
      valorAnterior: { precio: 150 },
      valorNuevo: { precio: 999.99 },
      correoUsuario: 'admin@shopcart.test',
    });
  });
});

describe('RF-03 Inventario', () => {
  it('un ajuste manual exige motivo', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const respuesta = await api()
      .post('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${operador}`)
      .send({ idVariante: producto.idVariante, tipo: 'AJUSTE_SALIDA', cantidad: 1, motivo: '' });
    expect(respuesta.status).toBe(400);
  });

  it('un ajuste no puede dejar la existencia en negativo', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const respuesta = await api()
      .post('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${operador}`)
      .send({ idVariante: producto.idVariante, tipo: 'AJUSTE_SALIDA', cantidad: 6, motivo: 'Conteo físico' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('EXISTENCIA_NEGATIVA');
  });

  it('cada movimiento queda en el kardex con usuario, fecha, motivo y cantidad', async () => {
    const producto = await nuevoProducto(admin, { existencia: 5 });
    const respuesta = await api()
      .post('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${operador}`)
      .send({ idVariante: producto.idVariante, tipo: 'AJUSTE_SALIDA', cantidad: 2, motivo: 'Producto dañado en bodega' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos).toMatchObject({ cantidad: -2, existenciaAnterior: 5, existenciaNueva: 3 });

    const kardex = await api()
      .get('/api/inventario/kardex')
      .query({ idVariante: producto.idVariante })
      .set('Authorization', `Bearer ${operador}`);
    expect(kardex.body.datos[0]).toMatchObject({
      tipoMovimiento: 'AJUSTE_SALIDA',
      motivo: 'Producto dañado en bodega',
      usuario: 'Luis Fernando Hernández',
    });
    expect(kardex.body.datos[0].fecha).toBeDefined();
  });

  it('la existencia disponible es la física menos lo reservado', async () => {
    const producto = await nuevoProducto(admin, { existencia: 10 });
    const cliente = await nuevoCliente();
    await api().post('/api/carrito/items').set('Authorization', `Bearer ${cliente.token}`).send({ idVariante: producto.idVariante, cantidad: 3 });
    await api().post('/api/checkout').set('Authorization', `Bearer ${cliente.token}`).send({ idDireccion: cliente.idDireccion, idMetodoEnvio: 1 });

    const existencias = await api()
      .get('/api/inventario/existencias')
      .query({ q: producto.sku })
      .set('Authorization', `Bearer ${operador}`);
    expect(existencias.body.datos[0]).toMatchObject({ existencia: 10, reservada: 3, disponible: 7 });
  });

  it('la existencia de cada variante coincide con la suma de su kardex', async () => {
    const respuesta = await api().get('/api/inventario/conciliacion').set('Authorization', `Bearer ${operador}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.resumen.variantesConError).toBe(0);
    expect(respuesta.body.datos.resumen.totalExistencia).toBe(respuesta.body.datos.resumen.totalKardex);
    expect(respuesta.body.datos.variantes).toEqual([]);
  });
});
