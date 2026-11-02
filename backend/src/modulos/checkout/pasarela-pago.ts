import { createHash } from 'node:crypto';

/**
 * Pasarela de pago SIMULADA (el reto no pide integrar un banco real).
 *
 * - Nunca se guarda el número completo ni el CVV: solo la marca y los últimos 4 dígitos.
 * - El código de autorización se deriva de la Idempotency-Key, así que si el mismo
 *   pago llega dos veces la "pasarela" responde la misma autorización (igual que
 *   Stripe o Adyen cuando reciben la misma clave de idempotencia).
 * - Tarjetas de prueba:
 *     4111 1111 1111 1111  aprobada (cualquier tarjeta válida por Luhn se aprueba)
 *     4000 0000 0000 0002  rechazada por el banco
 *     4000 0000 0000 9995  fondos insuficientes
 *
 * En producción el orden sería: autorizar -> crear el pedido -> capturar, y si el
 * pedido fallara se anularía la autorización.
 */
export interface DatosTarjeta {
  numero: string;
  titular: string;
  expiracion: string; // MM/AA
  cvv: string;
}

export type ResultadoCobro =
  | { aprobado: true; codigoAutorizacion: string; marca: string; ultimosDigitos: string }
  | { aprobado: false; motivo: string };

const RECHAZOS: Record<string, string> = {
  '4000000000000002': 'El banco emisor rechazó la tarjeta. Intenta con otra.',
  '4000000000009995': 'La tarjeta no tiene fondos suficientes.',
};

export function soloDigitos(numero: string): string {
  return numero.replace(/[\s-]/g, '');
}

/** Algoritmo de Luhn: detecta números de tarjeta mal escritos. */
export function luhnValido(numero: string): boolean {
  const digitos = soloDigitos(numero);
  if (!/^\d{13,19}$/.test(digitos)) return false;
  let suma = 0;
  let duplicar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (duplicar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
}

export function marcaDe(numero: string): string {
  const d = soloDigitos(numero);
  if (d.startsWith('4')) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  return 'OTRA';
}

/** La tarjeta vale hasta el último día del mes indicado. */
export function tarjetaVencida(expiracion: string, ahora = new Date()): boolean {
  const [mes, anio] = expiracion.split('/').map(Number);
  if (!mes || anio === undefined) return true;
  const finDeMes = new Date(Date.UTC(2000 + anio, mes, 1));
  return finDeMes <= ahora;
}

export function cobrar(tarjeta: DatosTarjeta, claveIdempotencia: string): ResultadoCobro {
  const numero = soloDigitos(tarjeta.numero);
  const rechazo = RECHAZOS[numero];
  if (rechazo) return { aprobado: false, motivo: rechazo };
  if (tarjetaVencida(tarjeta.expiracion)) return { aprobado: false, motivo: 'La tarjeta está vencida.' };

  const codigo = createHash('sha256').update(claveIdempotencia).digest('hex').slice(0, 10).toUpperCase();
  return { aprobado: true, codigoAutorizacion: `SIM-${codigo}`, marca: marcaDe(numero), ultimosDigitos: numero.slice(-4) };
}
