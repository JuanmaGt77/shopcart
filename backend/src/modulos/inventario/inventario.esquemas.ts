import { z } from 'zod';
import { booleanoEnQuery, idPositivo, paginacion } from '../../compartido/esquemas.js';

export const existenciasEsquema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  idCategoria: idPositivo.optional(),
  bajoStock: booleanoEnQuery.optional(),
  ...paginacion,
});

export const movimientoEsquema = z.strictObject({
  idVariante: idPositivo,
  tipo: z.enum(['ENTRADA_COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA']),
  cantidad: z.number().int().positive('La cantidad debe ser mayor a cero').max(100_000),
  motivo: z.string().trim().min(3, 'El motivo es obligatorio (mínimo 3 caracteres)').max(250),
});

export const kardexEsquema = z
  .strictObject({
    idVariante: idPositivo.optional(),
    tipo: z
      .enum(['ENTRADA_COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'SALIDA_VENTA', 'CANCELACION', 'DEVOLUCION'])
      .optional(),
    desde: z.iso.datetime({ offset: true }).optional(),
    hasta: z.iso.datetime({ offset: true }).optional(),
    ...paginacion,
  })
  .refine((f) => !f.desde || !f.hasta || new Date(f.desde) <= new Date(f.hasta), {
    message: 'La fecha inicial no puede ser mayor que la final',
    path: ['desde'],
  });

export const conciliacionEsquema = z.strictObject({
  soloDiferencias: booleanoEnQuery.default(true),
});

export type FiltroExistencias = z.infer<typeof existenciasEsquema>;
export type Movimiento = z.infer<typeof movimientoEsquema>;
export type FiltroKardex = z.infer<typeof kardexEsquema>;
