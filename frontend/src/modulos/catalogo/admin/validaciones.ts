import type { ImagenEntrada } from './api';
import type { VarianteNueva } from './combinaciones';
import type { ValoresDatos } from './editores';

/** Validaciones previas al envío (la API vuelve a validar todo con sus esquemas de Zod). */
export const datosValidos = (d: ValoresDatos) => Boolean(d.idCategoria && d.nombre.trim());

export const urlImagenValida = (url: string) => /^https?:\/\/\S+$/i.test(url.trim());

export const imagenesValidas = (imagenes: ImagenEntrada[]) => imagenes.every((i) => urlImagenValida(i.url));

export const skuValido = (sku: string) => /^[A-Z0-9-]{3,40}$/.test(sku);

export const variantesValidas = (variantes: VarianteNueva[]) =>
  variantes.length > 0 &&
  variantes.every((v) => skuValido(v.sku) && v.precio > 0) &&
  new Set(variantes.map((v) => v.sku)).size === variantes.length;
