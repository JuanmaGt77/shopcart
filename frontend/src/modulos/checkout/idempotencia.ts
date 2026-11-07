import { ErrorApi } from '@/api/cliente';

/**
 * Clave de idempotencia del pago (encabezado Idempotency-Key).
 *
 * Se genera UNA por intento de pago y se reusa si el mismo intento se repite (doble clic,
 * reintento porque se cortó la red o el servidor no respondió). Con la misma clave la API
 * devuelve el mismo pedido: nunca hay dos pedidos ni dos cobros.
 *
 * Se cambia por una nueva solo cuando la API ya respondió con un rechazo definitivo (4xx,
 * por ejemplo tarjeta rechazada): ese intento terminó y el siguiente es un intento nuevo.
 */
export function nuevaClaveIdempotencia(): string {
  // crypto.randomUUID solo existe en contextos seguros (https o localhost); getRandomValues siempre
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * ¿El intento terminó de forma definitiva? Solo entonces se usa una clave nueva.
 * Sin conexión (estado 0) o con un 5xx no sabemos si el cobro se hizo: se reusa la misma clave.
 */
export function intentoTerminado(error: unknown): boolean {
  return error instanceof ErrorApi && error.estado >= 400 && error.estado < 500;
}
