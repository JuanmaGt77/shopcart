import { pedir, pedirPaginado } from '@/api/cliente';
import type { Categoria, FiltrosProductos, ProductoDetalle, ProductoResumen } from './tipos';

export const apiCatalogo = {
  categorias: (incluirInactivas = false, senal?: AbortSignal) =>
    pedir<Categoria[]>('/categorias', {
      consulta: { incluirInactivas: incluirInactivas || undefined },
      senal,
    }),

  productos: (filtros: FiltrosProductos, senal?: AbortSignal) =>
    pedirPaginado<ProductoResumen>('/productos', { consulta: { ...filtros }, senal }),

  producto: (idProducto: number, senal?: AbortSignal) =>
    pedir<ProductoDetalle>(`/productos/${idProducto}`, { senal }),
};
