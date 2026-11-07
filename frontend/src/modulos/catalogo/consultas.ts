import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PREFIJO } from '@/api/claves';
import { apiCatalogo } from './api';
import type { FiltrosProductos } from './tipos';

export function useCategorias(incluirInactivas = false) {
  return useQuery({
    queryKey: [PREFIJO.categorias, { incluirInactivas }],
    queryFn: ({ signal }) => apiCatalogo.categorias(incluirInactivas, signal),
    staleTime: 5 * 60_000,
  });
}

/** Página de productos con los filtros del servidor; mientras llega la siguiente página se queda la anterior. */
export function useProductos(filtros: FiltrosProductos) {
  return useQuery({
    queryKey: [PREFIJO.productos, filtros],
    queryFn: ({ signal }) => apiCatalogo.productos(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function useProducto(idProducto: number) {
  return useQuery({
    queryKey: [PREFIJO.producto, idProducto],
    queryFn: ({ signal }) => apiCatalogo.producto(idProducto, signal),
    enabled: Number.isInteger(idProducto) && idProducto > 0,
  });
}
