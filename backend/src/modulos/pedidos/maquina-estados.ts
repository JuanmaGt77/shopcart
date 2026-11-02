import { ErrorAplicacion, ErrorProhibido } from '../../compartido/errores.js';
import type { Rol } from '../../compartido/http/tipos.js';

/**
 * Ciclo de vida del pedido (validación del lado del backend).
 *
 *   PAGADO ──► EN_PREPARACION ──► DESPACHADO ──► ENTREGADO ──► DEVUELTO_PARCIAL ──► DEVUELTO
 *     │              │                               └──────────────────────────────► DEVUELTO
 *     └──────────────┴──► CANCELADO
 *
 * La misma regla vive en la base (tabla EstadoPedidoTransicion + trigger
 * TR_Pedido_Estado): si alguien se salta la API, la base igual lo rechaza.
 * Aquí además se valida QUIÉN puede hacer cada paso.
 */
export const ESTADOS = [
  'PAGADO',
  'EN_PREPARACION',
  'DESPACHADO',
  'ENTREGADO',
  'DEVUELTO_PARCIAL',
  'DEVUELTO',
  'CANCELADO',
] as const;

export type EstadoPedido = (typeof ESTADOS)[number];

export const TRANSICIONES: Readonly<Record<EstadoPedido, readonly EstadoPedido[]>> = {
  PAGADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['DESPACHADO', 'CANCELADO'],
  DESPACHADO: ['ENTREGADO'],
  ENTREGADO: ['DEVUELTO_PARCIAL', 'DEVUELTO'],
  DEVUELTO_PARCIAL: ['DEVUELTO'],
  DEVUELTO: [],
  CANCELADO: [],
};

/** Quién puede llevar un pedido a cada estado. */
const ROLES_POR_DESTINO: Readonly<Record<EstadoPedido, readonly Rol[]>> = {
  PAGADO: [],
  EN_PREPARACION: ['OPERADOR', 'ADMIN'],
  DESPACHADO: ['OPERADOR', 'ADMIN'],
  ENTREGADO: ['OPERADOR', 'ADMIN'],
  CANCELADO: ['CLIENTE', 'OPERADOR', 'ADMIN'],
  DEVUELTO_PARCIAL: ['OPERADOR', 'ADMIN'],
  DEVUELTO: ['OPERADOR', 'ADMIN'],
};

const NOMBRES: Readonly<Record<EstadoPedido, string>> = {
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  DEVUELTO_PARCIAL: 'Devuelto parcialmente',
  DEVUELTO: 'Devuelto',
  CANCELADO: 'Cancelado',
};

export function transicionPermitida(actual: EstadoPedido, destino: EstadoPedido): boolean {
  return TRANSICIONES[actual].includes(destino);
}

export function validarTransicion(actual: EstadoPedido, destino: EstadoPedido, rol: Rol): void {
  if (!ROLES_POR_DESTINO[destino].includes(rol)) {
    throw new ErrorProhibido(`Tu rol no puede pasar pedidos a "${NOMBRES[destino]}".`);
  }
  if (!transicionPermitida(actual, destino)) {
    const mensaje =
      destino === 'CANCELADO'
        ? `El pedido está "${NOMBRES[actual]}" y ya no se puede cancelar. Solo se cancelan pedidos que no se han despachado.`
        : `No se puede pasar un pedido de "${NOMBRES[actual]}" a "${NOMBRES[destino]}".`;
    throw new ErrorAplicacion(409, destino === 'CANCELADO' ? 'PEDIDO_NO_CANCELABLE' : 'TRANSICION_NO_PERMITIDA', mensaje);
  }
}
