import { useQuery } from '@tanstack/react-query';
import { PREFIJO } from '@/api/claves';
import { useSesion } from '@/modulos/auth/use-sesion';
import { apiCarrito } from './api';

/** Clave del carrito: la del cliente lleva su id; la del visitante, "invitado". */
export function useClaveCarrito() {
  const { usuario } = useSesion();
  return [PREFIJO.carrito, usuario?.idUsuario ?? 'invitado'] as const;
}

/** El carrito es solo para clientes y visitantes: el personal no compra con su cuenta de trabajo. */
export function usePuedeComprar(): boolean {
  const { usuario } = useSesion();
  return !usuario || usuario.rol === 'CLIENTE';
}

export function useCarrito() {
  const { estado } = useSesion();
  const puedeComprar = usePuedeComprar();
  const clave = useClaveCarrito();
  return useQuery({
    queryKey: clave,
    queryFn: ({ signal }) => apiCarrito.obtener(signal),
    enabled: estado !== 'cargando' && puedeComprar,
    staleTime: 10_000,
  });
}
