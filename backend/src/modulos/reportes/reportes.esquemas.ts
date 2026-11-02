import { z } from 'zod';
import { fechaDia, paginacion, rangoValido } from '../../compartido/esquemas.js';

const rango = {
  desde: fechaDia.optional(),
  hasta: fechaDia.optional(),
};
const mensajeRango = { message: 'La fecha inicial no puede ser mayor que la final', path: ['desde'] };

export const rangoEsquema = z.strictObject(rango).refine(rangoValido, mensajeRango);

export const ventasEsquema = z
  .strictObject({ agrupacion: z.enum(['dia', 'semana', 'mes']).default('dia'), ...rango })
  .refine(rangoValido, mensajeRango);

export const topProductosEsquema = z
  .strictObject({ limite: z.coerce.number().int().min(1).max(50).default(10), ...rango })
  .refine(rangoValido, mensajeRango);

export const carritosAbandonadosEsquema = z.strictObject({
  horas: z.coerce.number().int().min(1).max(720).optional(),
  ...paginacion,
});

export type Rango = z.infer<typeof rangoEsquema>;
