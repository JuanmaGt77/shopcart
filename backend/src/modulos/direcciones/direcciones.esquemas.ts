import { z } from 'zod';
import { idPositivo, telefono, textoOpcional, textoRequerido } from '../../compartido/esquemas.js';

const camposDireccion = {
  alias: textoRequerido(50),
  nombreDestinatario: textoRequerido(150),
  telefono,
  linea1: textoRequerido(200),
  linea2: textoOpcional(200),
  zona: z.number().int().min(1).max(25).nullish(),
  municipio: textoRequerido(100),
  idDepartamento: idPositivo,
  codigoPostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal tiene 5 dígitos')
    .nullish(),
  referencia: textoOpcional(250),
};

export const crearDireccionEsquema = z.strictObject({
  ...camposDireccion,
  esPredeterminada: z.boolean().default(false),
});

export const actualizarDireccionEsquema = z.strictObject(camposDireccion);

export type NuevaDireccion = z.infer<typeof crearDireccionEsquema>;
export type CambiosDireccion = z.infer<typeof actualizarDireccionEsquema>;
