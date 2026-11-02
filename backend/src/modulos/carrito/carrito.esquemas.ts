import { z } from 'zod';
import { idPositivo } from '../../compartido/esquemas.js';

export const agregarEsquema = z.strictObject({
  idVariante: idPositivo,
  cantidad: z.number().int().min(1, 'La cantidad mínima es 1').max(999).default(1),
});

export const cantidadEsquema = z.strictObject({
  cantidad: z.number().int().min(1, 'La cantidad mínima es 1; para quitar el producto usa DELETE').max(999),
});

export const varianteEnRuta = z.strictObject({ idVariante: idPositivo });

export const cuponEsquema = z.strictObject({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, 'El código del cupón no es válido'),
});

export const fusionarEsquema = z.strictObject({
  tokenInvitado: z.uuid('El token del carrito de invitado no es válido'),
});

export const tokenInvitado = z.uuid('El encabezado X-Carrito-Token debe ser un UUID');
