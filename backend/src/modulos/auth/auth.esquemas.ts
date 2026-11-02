import { z } from 'zod';
import { correo, telefono, textoRequerido } from '../../compartido/esquemas.js';

export const contrasenaSegura = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga')
  .regex(/[a-z]/, 'La contraseña necesita al menos una minúscula')
  .regex(/[A-Z]/, 'La contraseña necesita al menos una mayúscula')
  .regex(/\d/, 'La contraseña necesita al menos un número');

export const registroEsquema = z.strictObject({
  correo,
  contrasena: contrasenaSegura,
  nombres: textoRequerido(100),
  apellidos: textoRequerido(100),
  telefono: telefono.optional(),
});

export const loginEsquema = z.strictObject({
  correo,
  contrasena: z.string().min(1, 'Escribe tu contraseña').max(128),
});

export type DatosRegistro = z.infer<typeof registroEsquema>;
export type DatosLogin = z.infer<typeof loginEsquema>;
