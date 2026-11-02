import { z } from 'zod';
import { booleanoEnQuery, correo, paginacion, telefono, textoRequerido } from '../../compartido/esquemas.js';
import { ROLES } from '../../compartido/http/tipos.js';
import { contrasenaSegura } from '../auth/auth.esquemas.js';

export const listarUsuariosEsquema = z.strictObject({
  texto: z.string().trim().max(100).optional(),
  rol: z.enum(ROLES).optional(),
  activo: booleanoEnQuery.optional(),
  ...paginacion,
});

export const crearUsuarioEsquema = z.strictObject({
  correo,
  contrasena: contrasenaSegura,
  nombres: textoRequerido(100),
  apellidos: textoRequerido(100),
  telefono: telefono.optional(),
  rol: z.enum(ROLES),
});

export const actualizarUsuarioEsquema = z.strictObject({
  nombres: textoRequerido(100),
  apellidos: textoRequerido(100),
  telefono: telefono.nullish(),
  rol: z.enum(ROLES),
});

export const estadoEsquema = z.strictObject({ activo: z.boolean() });

export type FiltroUsuarios = z.infer<typeof listarUsuariosEsquema>;
export type NuevoUsuario = z.infer<typeof crearUsuarioEsquema>;
export type CambiosUsuario = z.infer<typeof actualizarUsuarioEsquema>;
