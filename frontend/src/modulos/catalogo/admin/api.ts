import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pedir } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { mensajeDeError } from '@/lib/errores';
import type { Categoria, ProductoDetalle } from '../tipos';
import type { VarianteNueva } from './combinaciones';

export interface ImagenEntrada {
  url: string;
  textoAlternativo: string | null;
}

export interface DatosProducto {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
}

export interface DatosCategoria {
  nombre: string;
  descripcion: string | null;
}

export const apiCatalogoAdmin = {
  crearProducto: (datos: DatosProducto & { imagenes: ImagenEntrada[]; variantes: VarianteNueva[] }) =>
    pedir<ProductoDetalle>('/productos', { metodo: 'POST', cuerpo: datos }),
  actualizarProducto: (id: number, datos: DatosProducto) =>
    pedir<ProductoDetalle>(`/productos/${id}`, { metodo: 'PUT', cuerpo: datos }),
  reemplazarImagenes: (id: number, imagenes: ImagenEntrada[]) =>
    pedir<ProductoDetalle>(`/productos/${id}/imagenes`, { metodo: 'PUT', cuerpo: { imagenes } }),
  estadoProducto: (id: number, activo: boolean) =>
    pedir<ProductoDetalle>(`/productos/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } }),
  eliminarProducto: (id: number) =>
    pedir<{ resultado: string; mensaje: string }>(`/productos/${id}`, { metodo: 'DELETE' }),
  agregarVariante: (idProducto: number, variante: VarianteNueva) =>
    pedir<ProductoDetalle>(`/productos/${idProducto}/variantes`, { metodo: 'POST', cuerpo: variante }),
  precioVariante: (idVariante: number, precio: number) =>
    pedir<unknown>(`/variantes/${idVariante}/precio`, { metodo: 'PATCH', cuerpo: { precio } }),
  estadoVariante: (idVariante: number, activo: boolean) =>
    pedir<unknown>(`/variantes/${idVariante}/estado`, { metodo: 'PATCH', cuerpo: { activo } }),

  crearCategoria: (datos: DatosCategoria) =>
    pedir<Categoria>('/categorias', { metodo: 'POST', cuerpo: datos }),
  actualizarCategoria: (id: number, datos: DatosCategoria) =>
    pedir<Categoria>(`/categorias/${id}`, { metodo: 'PUT', cuerpo: datos }),
  estadoCategoria: (id: number, activo: boolean) =>
    pedir<Categoria>(`/categorias/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } }),
  eliminarCategoria: (id: number) => pedir<unknown>(`/categorias/${id}`, { metodo: 'DELETE' }),
};

/**
 * Mutación del catálogo: al terminar se invalidan productos, detalle y categorías (la tienda
 * además se entera por el evento catalogo:actualizado).
 */
export function useMutacionCatalogo<V, R>(
  funcion: (variables: V) => Promise<R>,
  mensajeExito: string | ((resultado: R) => string),
) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: funcion,
    onSuccess: (resultado) => {
      toast.success(typeof mensajeExito === 'function' ? mensajeExito(resultado) : mensajeExito);
      for (const prefijo of [PREFIJO.productos, PREFIJO.producto, PREFIJO.categorias, PREFIJO.inventario]) {
        void cliente.invalidateQueries({ queryKey: [prefijo] });
      }
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
}
