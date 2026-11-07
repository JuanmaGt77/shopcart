import { useQuery } from '@tanstack/react-query';
import { pedir } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';

export interface Departamento {
  idDepartamento: number;
  nombre: string;
}

export interface MetodoEnvio {
  idMetodoEnvio: number;
  codigo: 'ESTANDAR' | 'EXPRESS' | 'TIENDA' | string;
  nombre: string;
  descripcion: string | null;
  costo: number;
  diasEstimadosMin: number;
  diasEstimadosMax: number;
}

export interface EstadoPedidoCatalogo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

/** Catálogos públicos que casi no cambian: se guardan en caché un buen rato. */
export function useDepartamentos() {
  return useQuery({
    queryKey: [PREFIJO.sistema, 'departamentos'],
    queryFn: ({ signal }) => pedir<Departamento[]>('/catalogos/departamentos', { senal: signal }),
    staleTime: 60 * 60_000,
  });
}

export function useMetodosEnvio() {
  return useQuery({
    queryKey: [PREFIJO.sistema, 'metodos-envio'],
    queryFn: ({ signal }) => pedir<MetodoEnvio[]>('/catalogos/metodos-envio', { senal: signal }),
    staleTime: 60 * 60_000,
  });
}

/** "1 a 2 días", "1 día" */
export function textoDias(minimo: number, maximo: number): string {
  if (minimo === maximo) return `${minimo} ${minimo === 1 ? 'día' : 'días'}`;
  return `${minimo} a ${maximo} días`;
}

export interface EstadoPedidoConTransiciones {
  idEstadoPedido: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esInicial: boolean;
  esFinal: boolean;
  cuentaComoVenta: boolean;
  orden: number;
  /** Transiciones permitidas (tabla EstadoPedidoTransicion). */
  siguientes: { codigo: string; nombre: string }[];
}

/** Estados con sus transiciones permitidas: los botones del panel salen de aquí, no de una lista fija. */
export function useEstadosPedido() {
  return useQuery({
    queryKey: [PREFIJO.sistema, 'estados-pedido'],
    queryFn: ({ signal }) =>
      pedir<EstadoPedidoConTransiciones[]>('/catalogos/estados-pedido', { senal: signal }),
    staleTime: 60 * 60_000,
  });
}
