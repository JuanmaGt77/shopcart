import { z } from 'zod';
import { dinero, dineroOpcional, idPositivo, paginacion, textoOpcional } from '../../compartido/esquemas.js';

const fechaHora = z.iso.datetime({ offset: true, message: 'Usa una fecha ISO con zona, por ejemplo 2026-11-27T00:00:00-06:00' });

const camposCupon = {
  descripcion: textoOpcional(200),
  tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
  valor: dinero,
  montoMinimo: dineroOpcional.default(0),
  descuentoMaximo: dinero.nullish(),
  idCategoria: idPositivo.nullish(),
  fechaInicio: fechaHora,
  fechaFin: fechaHora,
  limiteUsosTotal: z.number().int().positive().nullish(),
  limiteUsosPorCliente: z.number().int().positive().nullish(),
};

function reglas<T extends { tipoDescuento: string; valor: number; fechaInicio: string; fechaFin: string }>(
  esquema: z.ZodType<T>,
) {
  return esquema
    .refine((c) => c.tipoDescuento !== 'PORCENTAJE' || c.valor <= 100, {
      message: 'Un porcentaje no puede ser mayor a 100',
      path: ['valor'],
    })
    .refine((c) => new Date(c.fechaFin) > new Date(c.fechaInicio), {
      message: 'La fecha de fin debe ser posterior a la de inicio',
      path: ['fechaFin'],
    });
}

export const crearCuponEsquema = reglas(
  z.strictObject({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,30}$/, 'El código solo admite letras, números, guion y guion bajo (3 a 30)'),
    ...camposCupon,
  }),
);

export const actualizarCuponEsquema = reglas(z.strictObject(camposCupon));

export const listarCuponesEsquema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(['VIGENTE', 'PROGRAMADO', 'VENCIDO', 'AGOTADO', 'INACTIVO']).optional(),
  ...paginacion,
});

export const usosEsquema = z.strictObject({ ...paginacion });

export type NuevoCupon = z.infer<typeof crearCuponEsquema>;
export type CambiosCupon = z.infer<typeof actualizarCuponEsquema>;
export type FiltroCupones = z.infer<typeof listarCuponesEsquema>;
