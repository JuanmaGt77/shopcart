/**
 * Claves de TanStack Query. Cada consulta empieza con uno de estos prefijos; así el tiempo real
 * y las mutaciones pueden invalidar "todo lo de productos" o "todos los pedidos" de una vez.
 * Las consultas privadas llevan el id del usuario en la clave, para que nunca se mezclen
 * datos de dos cuentas que usen el mismo navegador.
 */
export const PREFIJO = {
  categorias: 'categorias',
  productos: 'productos',
  producto: 'producto',
  atributos: 'atributos',
  carrito: 'carrito',
  checkout: 'checkout',
  direcciones: 'direcciones',
  pedidos: 'pedidos',
  pedido: 'pedido',
  inventario: 'inventario',
  cupones: 'cupones',
  usuarios: 'usuarios',
  reportes: 'reportes',
  bitacora: 'bitacora',
  sistema: 'sistema',
} as const;
