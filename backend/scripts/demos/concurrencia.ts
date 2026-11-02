/**
 * DEMO: varios clientes intentan comprar la ÚLTIMA unidad al mismo tiempo.
 *   npm run demo:concurrencia          (10 clientes)
 *   npm run demo:concurrencia -- 25    (25 clientes)
 *
 * Todos tienen el producto en su carrito y presionan "Ir a pagar" en el mismo
 * instante. Solo uno logra reservar la unidad; los demás reciben un mensaje claro.
 */
import { api, color, crearClientes, crearProducto, loginAdmin, TARJETA, titulo, verificarApi } from './utilidades.js';

const cantidad = Number(process.argv[2] ?? 10);

await verificarApi();
titulo(`Concurrencia: ${cantidad} clientes van por la última unidad`);

const admin = await loginAdmin();
const producto = await crearProducto(admin, 'Playera edición única', 1);
console.log(`Producto ${color.amarillo(producto.sku)} creado con ${color.negrita('1')} unidad en existencia.`);

const clientes = await crearClientes(admin, cantidad, 'concurrencia');
for (const cliente of clientes) {
  await api('POST', '/carrito/items', { token: cliente.token, body: { idVariante: producto.idVariante, cantidad: 1 } });
}
console.log(`${cantidad} clientes tienen la playera en su carrito. Todos presionan "Ir a pagar" a la vez...\n`);

const inicio = performance.now();
const intentos = await Promise.all(
  clientes.map((c) => api('POST', '/checkout', { token: c.token, body: { idDireccion: c.idDireccion, idMetodoEnvio: 1 } })),
);
const ms = performance.now() - inicio;

intentos.forEach((r, i) => {
  const nombre = clientes[i]!.nombre.padEnd(8);
  if (r.estado === 201) console.log(`  ${color.verde('✔')} ${nombre} ${color.verde('reservó la unidad')} (checkout ${r.cuerpo!.datos.idCheckout})`);
  else console.log(`  ${color.rojo('✘')} ${nombre} ${color.gris(`${r.estado} ${r.cuerpo?.error?.codigo}: ${r.cuerpo?.error?.mensaje}`)}`);
});

const ganadores = intentos.filter((r) => r.estado === 201);
const indice = intentos.findIndex((r) => r.estado === 201);
if (indice >= 0) {
  const pago = await api('POST', `/checkout/${ganadores[0]!.cuerpo!.datos.idCheckout}/pagar`, {
    token: clientes[indice]!.token,
    body: { tarjeta: TARJETA },
    encabezados: { 'Idempotency-Key': crypto.randomUUID() },
  });
  console.log(`\n${clientes[indice]!.nombre} pagó: pedido ${color.verde(pago.cuerpo!.datos.pedido.numeroPedido)}`);
}

const detalle = await api('GET', `/productos/${producto.idProducto}`, { token: admin });
const variante = detalle.cuerpo!.datos.variantes[0];
console.log(`\nResultado: ${color.negrita(String(ganadores.length))} reserva(s) de ${cantidad} intentos en ${ms.toFixed(0)} ms.`);
console.log(`Existencia final: ${variante.existencia}  ·  Reservada: ${variante.reservada}  ·  Disponible: ${variante.disponible}`);
console.log(ganadores.length === 1 && variante.existencia === 0 ? color.verde('\n✔ Nunca hubo sobreventa.') : color.rojo('\n✘ Algo no cuadra.'));
