import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pedir, pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import type { CodigoEstadoPedido } from '@/modulos/pedidos/estados';

export type Agrupacion = 'dia' | 'semana' | 'mes';

export interface Rango {
  desde: string;
  hasta: string;
}

/** Ventas netas: sin cancelados y restando lo devuelto (las calcula SQL Server). */
export interface Resumen {
  desde: string;
  hasta: string;
  ventasNetas: number;
  pedidos: number;
  ticketPromedio: number;
  montoDevuelto: number;
  unidadesVendidas: number;
  pedidosCancelados: number;
  carritosAbandonados: number;
  variantesBajoStock: number;
  clientesNuevos: number;
  pedidosPorEstado: { codigo: CodigoEstadoPedido; nombre: string; pedidos: number }[];
}

export interface PuntoVentas {
  periodo: string;
  pedidos: number;
  montoVendido: number;
  ticketPromedio: number;
}

export interface VentaCategoria {
  idCategoria: number;
  categoria: string;
  unidades: number;
  monto: number;
  pedidos: number;
  porcentaje: number;
}

export interface ProductoTop {
  posicion: string;
  idProducto: number;
  producto: string;
  categoria: string;
  unidades: number;
  monto: number;
  pedidos: number;
}

export interface CarritoAbandonado {
  idCarrito: number;
  idUsuario: number | null;
  cliente: string;
  correo: string | null;
  cantidadArticulos: number;
  cantidadLineas: number;
  valorEstimado: number;
  fechaUltimaActividad: string;
  horasInactivo: number;
  horasConfiguradas: number;
  valorTotalAbandonado: number;
}

/**
 * Todas las consultas del dashboard empiezan con PREFIJO.reportes: el evento dashboard:actualizar
 * las invalida juntas y se vuelven a pedir (la API tiene caché que se invalida con cada venta).
 */
const clave = (...partes: unknown[]) => [PREFIJO.reportes, ...partes];

export function useResumen(rango: Rango) {
  return useQuery({
    queryKey: clave('resumen', rango),
    queryFn: ({ signal }) => pedir<Resumen>('/reportes/resumen', { consulta: { ...rango }, senal: signal }),
    placeholderData: keepPreviousData,
  });
}

export function useVentas(rango: Rango, agrupacion: Agrupacion) {
  return useQuery({
    queryKey: clave('ventas', rango, agrupacion),
    queryFn: ({ signal }) =>
      pedir<PuntoVentas[]>('/reportes/ventas', { consulta: { ...rango, agrupacion }, senal: signal }),
    placeholderData: keepPreviousData,
  });
}

export function useVentasPorCategoria(rango: Rango) {
  return useQuery({
    queryKey: clave('categorias', rango),
    queryFn: ({ signal }) =>
      pedir<VentaCategoria[]>('/reportes/ventas-por-categoria', { consulta: { ...rango }, senal: signal }),
    placeholderData: keepPreviousData,
  });
}

export function useTopProductos(rango: Rango) {
  return useQuery({
    queryKey: clave('top', rango),
    queryFn: ({ signal }) =>
      pedir<ProductoTop[]>('/reportes/top-productos', { consulta: { ...rango, limite: 10 }, senal: signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCarritosAbandonados(pagina: number) {
  return useQuery({
    queryKey: clave('abandonados', pagina),
    queryFn: ({ signal }) =>
      pedirPaginado<CarritoAbandonado>('/reportes/carritos-abandonados', {
        consulta: { pagina, tamanoPagina: 5 },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  });
}
