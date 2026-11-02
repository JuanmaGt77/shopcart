/**
 * DEMO: el cliente presiona "Pagar" varias veces (doble clic) o el navegador
 * reintenta porque se cayó la red.
 *   npm run demo:idempotencia
 *
 * Se mandan 5 pagos simultáneos con la misma Idempotency-Key y luego un reintento.
 * Resultado esperado: un solo pedido, un solo cobro y una sola salida de inventario.
 */
import { api, color, crearClientes, crearProducto, loginAdmin, TARJETA, titulo, verificarApi } from './utilidades.js';

await verificarApi();
titulo('Idempotencia: doble clic y reintento en el pago');

const admin = await loginAdmin();
const producto = await crearProducto(admin, 'Sudadera demo', 10, 299);
const [cliente] = await crearClientes(admin, 1, 'idempotencia');
await api('POST', '/carrito/items', { token: cliente!.token, body: { idVariante: producto.idVariante, cantidad: 2 } });
const checkout = await api('POST', '/checkout', {
  token: cliente!.token,
  body: { idDireccion: cliente!.idDireccion, idMetodoEnvio: 1 },
});
const idCheckout = checkout.cuerpo!.datos.idCheckout;
const clave = crypto.randomUUID();
console.log(`Checkout ${idCheckout} por Q${checkout.cuerpo!.datos.total}. Idempotency-Key: ${color.amarillo(clave)}\n`);

const pagar = () =>
  api('POST', `/checkout/${idCheckout}/pagar`, {
    token: cliente!.token,
    body: { tarjeta: TARJETA },
    encabezados: { 'Idempotency-Key': clave },
  });

console.log('5 clics en "Pagar" al mismo tiempo:');
const pagos = await Promise.all(Array.from({ length: 5 }, pagar));
pagos.forEach((r, i) => {
  const datos = r.cuerpo!.datos;
  console.log(
    `  clic ${i + 1}: HTTP ${r.estado}  pedido ${datos.pedido.numeroPedido}  ${datos.duplicado ? color.gris('(repetido: se devolvió el existente)') : color.verde('(creado)')}`,
  );
});

console.log('\nReintento 3 segundos después (como si se hubiera caído la red):');
await new Promise((r) => setTimeout(r, 3000));
const reintento = await pagar();
console.log(`  HTTP ${reintento.estado}  pedido ${reintento.cuerpo!.datos.pedido.numeroPedido}  duplicado=${reintento.cuerpo!.datos.duplicado}`);

const misPedidos = await api('GET', '/pedidos/mios', { token: cliente!.token });
const kardex = await api('GET', `/inventario/kardex?idVariante=${producto.idVariante}`, { token: admin });
const ventas = kardex.cuerpo!.datos.filter((k: { tipoMovimiento: string }) => k.tipoMovimiento === 'SALIDA_VENTA');
const numeros = new Set(pagos.map((p) => p.cuerpo!.datos.pedido.idPedido));

console.log(`\nPedidos del cliente: ${color.negrita(String(misPedidos.cuerpo!.paginacion.totalRegistros))}`);
console.log(`Pedidos distintos devueltos: ${numeros.size}  ·  Salidas de inventario: ${ventas.length}`);
console.log(
  misPedidos.cuerpo!.paginacion.totalRegistros === 1 && ventas.length === 1
    ? color.verde('\n✔ Un solo pedido y un solo cobro.')
    : color.rojo('\n✘ Se duplicó algo.'),
);
