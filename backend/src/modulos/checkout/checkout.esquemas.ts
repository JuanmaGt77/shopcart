import { z } from 'zod';
import { idPositivo } from '../../compartido/esquemas.js';
import { luhnValido } from './pasarela-pago.js';

export const iniciarCheckoutEsquema = z.strictObject({
  idDireccion: idPositivo,
  idMetodoEnvio: idPositivo,
});

export const pagarEsquema = z.strictObject({
  tarjeta: z.strictObject({
    numero: z.string().trim().refine(luhnValido, 'El número de tarjeta no es válido'),
    titular: z.string().trim().min(3, 'Escribe el nombre como aparece en la tarjeta').max(100),
    expiracion: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Usa el formato MM/AA'),
    cvv: z.string().regex(/^\d{3,4}$/, 'El CVV tiene 3 o 4 dígitos'),
  }),
});

/** La clave de idempotencia la genera el frontend (un UUID por intento de pago). */
export const claveIdempotencia = z
  .string({ message: 'Falta el encabezado Idempotency-Key' })
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Idempotency-Key debe tener entre 8 y 100 caracteres (letras, números, - o _)');

export type DatosPago = z.infer<typeof pagarEsquema>;
