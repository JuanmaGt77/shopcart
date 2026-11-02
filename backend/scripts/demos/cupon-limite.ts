/**
 * DEMO: un cupón con límite de 3 usos y 10 clientes pagando al mismo tiempo.
 *   npm run demo:cupon
 *
 * Solo 3 pagos lo consiguen; a los demás se les rechaza con "El cupón se agotó" y no
 * se les crea pedido (la operación es atómica: nada queda a medias).
 */
import { api, color, crearClientes, crearProducto, loginAdmin, TARJETA, titulo, verificarApi } from './utilidades.js';

const LIMITE = 3;
const CLIENTES = 10;

await verificarApi();
titulo(`Cupón con límite de ${LIMITE} usos y ${CLIENTES} clientes pagando a la vez`);

const admin = await loginAdmin();
const codigo = `FLASH${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
await api('POST', '/cupones', {
  token: admin,
  body: {
    codigo,
    tipoDescuento: 'PORCENTAJE',
    valor: 20,
    fechaInicio: '2026-01-01T00:00:00-06:00',
    fechaFin: '2027-12-31T23:59:59-06:00',
    limiteUsosTotal: LIMITE,
  },
});
const producto = await crearProducto(admin, 'Gorra demo', 50, 120);
console.log(`Cupón ${color.amarillo(codigo)} (20 %) con límite total de ${LIMITE} usos.`);

const clientes = await crearClientes(admin, CLIENTES, 'cupon');
const checkouts: number[] = [];
for (const cliente of clientes) {
  await api('POST', '/carrito/items', { token: cliente.token, body: { idVariante: producto.idVariante, cantidad: 1 } });
  await api('POST', '/carrito/cupon', { token: cliente.token, body: { codigo } });
  const checkout = await api('POST', '/checkout', { token: cliente.token, body: { idDireccion: cliente.idDireccion, idMetodoEnvio: 3 } });
  checkouts.push(checkout.cuerpo!.datos.idCheckout);
}
console.log(`${CLIENTES} clientes con el cupón aplicado. Todos presionan "Pagar" al mismo tiempo...\n`);

const pagos = await Promise.all(
  clientes.map((c, i) =>
    api('POST', `/checkout/${checkouts[i]}/pagar`, {
      token: c.token,
      body: { tarjeta: TARJETA },
      encabezados: { 'Idempotency-Key': crypto.randomUUID() },
    }),
  ),
);

pagos.forEach((r, i) => {
  const nombre = clientes[i]!.nombre.padEnd(8);
  if (r.estado === 201) console.log(`  ${color.verde('✔')} ${nombre} pagó con descuento: pedido ${r.cuerpo!.datos.pedido.numeroPedido}`);
  else console.log(`  ${color.rojo('✘')} ${nombre} ${color.gris(`${r.cuerpo?.error?.codigo}: ${r.cuerpo?.error?.mensaje}`)}`);
});

const cupones = await api('GET', `/cupones?q=${codigo}`, { token: admin });
const cupon = cupones.cuerpo!.datos[0];
const exitosos = pagos.filter((p) => p.estado === 201).length;
console.log(`\nUsos registrados del cupón: ${color.negrita(String(cupon.usosActuales))} de ${cupon.limiteUsosTotal} (estado ${cupon.estado})`);
console.log(exitosos === LIMITE ? color.verde(`\n✔ Exactamente ${LIMITE} pagos usaron el cupón.`) : color.rojo('\n✘ No cuadra.'));
