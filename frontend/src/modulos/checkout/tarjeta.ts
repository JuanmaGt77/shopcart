/**
 * Ayudas para el formulario de tarjeta. La validación definitiva la hace la API (pasarela simulada);
 * aquí solo se avisa antes de enviar y se da formato mientras se escribe.
 */

/** Algoritmo de Luhn: el dígito verificador con el que se detectan números mal escritos. */
export function luhnValido(numero: string): boolean {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

/** "4111111111111111" -> "4111 1111 1111 1111" */
export function formatearNumeroTarjeta(texto: string): string {
  return texto
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" -> "12/28" mientras se escribe */
export function formatearExpiracion(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
}

/** La fecha MM/AA no está vencida (la tarjeta vale hasta el último día de ese mes). */
export function expiracionVigente(texto: string, hoy = new Date()): boolean {
  const coincidencia = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(texto);
  if (!coincidencia) return false;
  const mes = Number(coincidencia[1]);
  const anio = 2000 + Number(coincidencia[2]);
  return anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1);
}

export function marcaTarjeta(numero: string): string | null {
  const digitos = numero.replace(/\D/g, '');
  if (/^4/.test(digitos)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digitos)) return 'Mastercard';
  if (/^3[47]/.test(digitos)) return 'American Express';
  return null;
}

/** Tarjetas de prueba de la pasarela simulada (las documenta la API en Swagger y el README). */
export const TARJETAS_DE_PRUEBA = [
  { etiqueta: 'Aprobada', numero: '4111 1111 1111 1111' },
  { etiqueta: 'Rechazada', numero: '4000 0000 0000 0002' },
  { etiqueta: 'Sin fondos', numero: '4000 0000 0000 9995' },
] as const;
