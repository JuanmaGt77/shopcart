import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pedir, pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { mensajeDeError } from '@/lib/errores';

export const ESTADOS_CUPON = ['VIGENTE', 'PROGRAMADO', 'VENCIDO', 'AGOTADO', 'INACTIVO'] as const;
export type EstadoCupon = (typeof ESTADOS_CUPON)[number];

export const NOMBRE_ESTADO_CUPON: Record<EstadoCupon, string> = {
  VIGENTE: 'Vigente',
  PROGRAMADO: 'Programado',
  VENCIDO: 'Vencido',
  AGOTADO: 'Agotado',
  INACTIVO: 'Inactivo',
};

export interface Cupon {
  idCupon: number;
  codigo: string;
  descripcion: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  montoMinimo: number;
  descuentoMaximo: number | null;
  idCategoria: number | null;
  categoria: string | null;
  fechaInicio: string;
  fechaFin: string;
  limiteUsosTotal: number | null;
  limiteUsosPorCliente: number | null;
  usosActuales: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  estado: EstadoCupon;
}

export interface UsoCupon {
  idCuponUso: number;
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  cliente: string;
  montoDescuento: number;
  estado: 'APLICADO' | 'REVERTIDO' | string;
  fechaUso: string;
  fechaReversion: string | null;
}

export interface DatosCupon {
  codigo?: string;
  descripcion: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  montoMinimo: number;
  descuentoMaximo: number | null;
  idCategoria: number | null;
  fechaInicio: string;
  fechaFin: string;
  limiteUsosTotal: number | null;
  limiteUsosPorCliente: number | null;
}

export const apiCupones = {
  listar: (
    filtros: { q?: string | undefined; estado?: EstadoCupon | undefined; pagina: number },
    senal?: AbortSignal,
  ) => pedirPaginado<Cupon>('/cupones', { consulta: { ...filtros, tamanoPagina: 20 }, senal }),
  crear: (datos: DatosCupon) => pedir<Cupon>('/cupones', { metodo: 'POST', cuerpo: datos }),
  actualizar: (id: number, { codigo: _codigo, ...datos }: DatosCupon) =>
    pedir<Cupon>(`/cupones/${id}`, { metodo: 'PUT', cuerpo: datos }),
  estado: (id: number, activo: boolean) =>
    pedir<Cupon>(`/cupones/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } }),
  usos: (id: number, pagina: number, senal?: AbortSignal) =>
    pedirPaginado<UsoCupon>(`/cupones/${id}/usos`, { consulta: { pagina, tamanoPagina: 10 }, senal }),
};

export function useCupones(filtros: {
  q?: string | undefined;
  estado?: EstadoCupon | undefined;
  pagina: number;
}) {
  return useQuery({
    queryKey: [PREFIJO.cupones, filtros],
    queryFn: ({ signal }) => apiCupones.listar(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUsosCupon(idCupon: number | null, pagina: number) {
  return useQuery({
    queryKey: [PREFIJO.cupones, 'usos', idCupon, pagina],
    queryFn: ({ signal }) => apiCupones.usos(idCupon ?? 0, pagina, signal),
    enabled: idCupon !== null,
    placeholderData: keepPreviousData,
  });
}

export function useMutacionCupon<V, R>(funcion: (v: V) => Promise<R>, mensaje: string | ((r: R) => string)) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: funcion,
    onSuccess: (r) => {
      toast.success(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.cupones] });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
}
