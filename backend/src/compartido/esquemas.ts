import { z } from 'zod';

// Mensajes de validación en español para toda la API
z.config(z.locales.es());

/** Montos en quetzales: positivos y con máximo dos decimales (igual que DECIMAL(12,2)). */
export const dinero = z
  .number()
  .positive('El monto debe ser mayor a cero')
  .max(9_999_999_999.99)
  .refine((valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6, 'Usa como máximo dos decimales');

export const dineroOpcional = z
  .number()
  .min(0, 'El monto no puede ser negativo')
  .max(9_999_999_999.99)
  .refine((valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6, 'Usa como máximo dos decimales');

export const idPositivo = z.coerce.number().int().positive();

export const idEnRuta = z.strictObject({ id: idPositivo });

export const textoRequerido = (maximo: number) => z.string().trim().min(1, 'Este campo es obligatorio').max(maximo);

export const textoOpcional = (maximo: number) => z.string().trim().max(maximo).nullish();

export const correo = z.string().trim().toLowerCase().max(254).pipe(z.email('El correo no es válido'));

export const telefono = z
  .string()
  .trim()
  .regex(/^[0-9 +-]{8,20}$/, 'El teléfono debe tener al menos 8 dígitos');

export const booleanoEnQuery = z.stringbool({ truthy: ['true', '1', 'si'], falsy: ['false', '0', 'no'] });

/** Fecha sin hora (AAAA-MM-DD), interpretada como día de Guatemala. */
export const fechaDia = z.iso.date('Usa el formato AAAA-MM-DD');

export const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).default(20),
};

/** Valida que "desde" no sea mayor que "hasta" cuando vienen los dos. */
export function rangoValido(datos: { desde?: string | undefined; hasta?: string | undefined }): boolean {
  return !datos.desde || !datos.hasta || datos.desde <= datos.hasta;
}
