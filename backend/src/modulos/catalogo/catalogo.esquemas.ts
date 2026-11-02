import { z } from 'zod';
import {
  booleanoEnQuery,
  dinero,
  idPositivo,
  paginacion,
  textoOpcional,
  textoRequerido,
} from '../../compartido/esquemas.js';

export const listarCategoriasEsquema = z.strictObject({
  incluirInactivas: booleanoEnQuery.optional(),
});

export const categoriaEsquema = z.strictObject({
  nombre: textoRequerido(100),
  descripcion: textoOpcional(500),
});

export const estadoEsquema = z.strictObject({ activo: z.boolean() });

export const buscarProductosEsquema = z
  .strictObject({
    q: z.string().trim().max(100).optional(),
    idCategoria: idPositivo.optional(),
    precioMin: z.coerce.number().min(0).optional(),
    precioMax: z.coerce.number().min(0).optional(),
    disponible: booleanoEnQuery.optional(),
    ordenarPor: z.enum(['nombre', 'precio', 'recientes']).default('recientes'),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    incluirInactivos: booleanoEnQuery.optional(),
    ...paginacion,
  })
  .refine((f) => f.precioMin === undefined || f.precioMax === undefined || f.precioMin <= f.precioMax, {
    message: 'El precio mínimo no puede ser mayor que el máximo',
    path: ['precioMin'],
  });

const sku = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,40}$/, 'El SKU solo admite letras, números y guiones (3 a 40 caracteres)');

/** Atributos como objeto: { "Talla": "M", "Color": "Negro" } */
const atributos = z
  .record(z.string().trim().min(1).max(50), z.string().trim().min(1).max(50))
  .refine((valor) => Object.keys(valor).length <= 5, 'Una variante puede tener como máximo 5 atributos')
  .default({});

const imagen = z.strictObject({
  url: z.url({ protocol: /^https?$/, message: 'La imagen debe ser una URL http(s)' }).max(500),
  textoAlternativo: textoOpcional(150),
});

export const varianteEsquema = z.strictObject({
  sku,
  precio: dinero,
  existenciaInicial: z.number().int().min(0).max(100_000).default(0),
  atributos,
});

export const crearProductoEsquema = z.strictObject({
  idCategoria: idPositivo,
  nombre: textoRequerido(150),
  descripcion: textoOpcional(2000),
  marca: textoOpcional(80),
  imagenes: z.array(imagen).max(10).default([]),
  variantes: z
    .array(varianteEsquema)
    .min(1, 'El producto necesita al menos una variante')
    .max(100)
    .refine((v) => new Set(v.map((x) => x.sku)).size === v.length, 'Hay SKU repetidos en las variantes'),
});

export const actualizarProductoEsquema = z.strictObject({
  idCategoria: idPositivo,
  nombre: textoRequerido(150),
  descripcion: textoOpcional(2000),
  marca: textoOpcional(80),
});

export const imagenesEsquema = z.strictObject({ imagenes: z.array(imagen).max(10) });

export const precioEsquema = z.strictObject({ precio: dinero });

export type FiltroProductos = z.infer<typeof buscarProductosEsquema>;
export type NuevoProducto = z.infer<typeof crearProductoEsquema>;
export type CambiosProducto = z.infer<typeof actualizarProductoEsquema>;
export type NuevaVariante = z.infer<typeof varianteEsquema>;
export type DatosCategoria = z.infer<typeof categoriaEsquema>;
export type Imagen = z.infer<typeof imagen>;
