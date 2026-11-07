import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pedir, pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';

export interface Existencia {
  idVariante: number;
  idProducto: number;
  sku: string;
  nombreProducto: string;
  descripcionVariante: string | null;
  idCategoria: number;
  categoria: string;
  precio: number;
  existencia: number;
  reservada: number;
  disponible: number;
  varianteActiva: boolean;
  productoActivo: boolean;
  bajoStock: boolean;
}

export type TipoMovimiento =
  'ENTRADA_COMPRA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'SALIDA_VENTA' | 'CANCELACION' | 'DEVOLUCION';

export const TIPOS_MANUALES = ['ENTRADA_COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA'] as const;

export const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA_COMPRA: 'Entrada por compra',
  AJUSTE_ENTRADA: 'Ajuste positivo',
  AJUSTE_SALIDA: 'Ajuste negativo',
  SALIDA_VENTA: 'Salida por venta',
  CANCELACION: 'Reingreso por cancelación',
  DEVOLUCION: 'Reingreso por devolución',
};

export interface MovimientoKardex {
  idKardex: number;
  idVariante: number;
  sku: string;
  nombreProducto: string;
  tipoMovimiento: TipoMovimiento;
  nombreTipo: string;
  naturaleza: 'E' | 'S';
  cantidad: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  motivo: string | null;
  idPedido: number | null;
  numeroPedido: string | null;
  idDevolucion: number | null;
  idUsuario: number | null;
  usuario: string | null;
  fecha: string;
}

export interface Conciliacion {
  resumen: {
    variantesRevisadas: number;
    variantesConError: number;
    totalExistencia: number;
    totalKardex: number;
  };
  variantes: {
    idVariante: number;
    sku: string;
    existencia: number;
    sumaKardex: number;
    diferencia: number;
    movimientos: number;
    saldoUltimoMovimiento: number;
    cuadra: boolean;
  }[];
}

export interface FiltrosExistencias {
  q?: string | undefined;
  idCategoria?: number | undefined;
  bajoStock?: boolean | undefined;
  pagina?: number | undefined;
  tamanoPagina?: number | undefined;
}

export interface FiltrosKardex {
  idVariante?: number | undefined;
  tipo?: TipoMovimiento | undefined;
  desde?: string | undefined;
  hasta?: string | undefined;
  pagina?: number | undefined;
  tamanoPagina?: number | undefined;
}

export const apiInventario = {
  existencias: (filtros: FiltrosExistencias, senal?: AbortSignal) =>
    pedirPaginado<Existencia>('/inventario/existencias', { consulta: { ...filtros }, senal }),

  registrarMovimiento: (datos: { idVariante: number; tipo: string; cantidad: number; motivo: string }) =>
    pedir<unknown>('/inventario/movimientos', { metodo: 'POST', cuerpo: datos }),

  kardex: (filtros: FiltrosKardex, senal?: AbortSignal) =>
    pedirPaginado<MovimientoKardex>('/inventario/kardex', { consulta: { ...filtros }, senal }),

  conciliacion: (soloDiferencias: boolean, senal?: AbortSignal) =>
    pedir<Conciliacion>('/inventario/conciliacion', { consulta: { soloDiferencias }, senal }),
};

export function useExistencias(filtros: FiltrosExistencias) {
  return useQuery({
    queryKey: [PREFIJO.inventario, 'existencias', filtros],
    queryFn: ({ signal }) => apiInventario.existencias(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function useKardex(filtros: FiltrosKardex) {
  return useQuery({
    queryKey: [PREFIJO.inventario, 'kardex', filtros],
    queryFn: ({ signal }) => apiInventario.kardex(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function useConciliacion(soloDiferencias: boolean) {
  return useQuery({
    queryKey: [PREFIJO.inventario, 'conciliacion', soloDiferencias],
    queryFn: ({ signal }) => apiInventario.conciliacion(soloDiferencias, signal),
  });
}
