import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pedir, pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { useSesion } from '@/modulos/auth/use-sesion';
import type { CodigoEstadoPedido } from './estados';
import type { Devolucion, PedidoDetalle, PedidoResumen } from './tipos';

export interface FiltrosMisPedidos {
  estado?: CodigoEstadoPedido | undefined;
  pagina?: number | undefined;
  tamanoPagina?: number | undefined;
}

export interface FiltrosPedidos extends FiltrosMisPedidos {
  cliente?: string | undefined;
  idCliente?: number | undefined;
  desde?: string | undefined;
  hasta?: string | undefined;
  ordenarPor?: 'fecha' | 'total' | 'numero' | undefined;
  direccion?: 'asc' | 'desc' | undefined;
}

export interface LineaDevolucion {
  idPedidoDetalle: number;
  cantidad: number;
}

export const apiPedidos = {
  mios: (filtros: FiltrosMisPedidos, senal?: AbortSignal) =>
    pedirPaginado<PedidoResumen>('/pedidos/mios', { consulta: { ...filtros }, senal }),

  listar: (filtros: FiltrosPedidos, senal?: AbortSignal) =>
    pedirPaginado<PedidoResumen>('/pedidos', { consulta: { ...filtros }, senal }),

  detalle: (idPedido: number, senal?: AbortSignal) => pedir<PedidoDetalle>(`/pedidos/${idPedido}`, { senal }),

  cancelar: (idPedido: number, motivo: string) =>
    pedir<PedidoDetalle>(`/pedidos/${idPedido}/cancelar`, { metodo: 'POST', cuerpo: { motivo } }),

  cambiarEstado: (idPedido: number, estado: CodigoEstadoPedido, comentario?: string) =>
    pedir<PedidoDetalle>(`/pedidos/${idPedido}/estado`, {
      metodo: 'PATCH',
      cuerpo: { estado, comentario: comentario?.trim() || undefined },
    }),

  devolver: (idPedido: number, motivo: string, lineas: LineaDevolucion[]) =>
    pedir<PedidoDetalle>(`/pedidos/${idPedido}/devoluciones`, { metodo: 'POST', cuerpo: { motivo, lineas } }),

  devoluciones: (idPedido: number, senal?: AbortSignal) =>
    pedir<Devolucion[]>(`/pedidos/${idPedido}/devoluciones`, { senal }),
};

export function useMisPedidos(filtros: FiltrosMisPedidos) {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: [PREFIJO.pedidos, 'mios', usuario?.idUsuario, filtros],
    queryFn: ({ signal }) => apiPedidos.mios(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePedidos(filtros: FiltrosPedidos) {
  return useQuery({
    queryKey: [PREFIJO.pedidos, 'todos', filtros],
    queryFn: ({ signal }) => apiPedidos.listar(filtros, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePedido(idPedido: number) {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: [PREFIJO.pedido, usuario?.idUsuario, idPedido],
    queryFn: ({ signal }) => apiPedidos.detalle(idPedido, signal),
    enabled: Number.isInteger(idPedido) && idPedido > 0,
  });
}
