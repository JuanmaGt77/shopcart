import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
import { mensajeDeError } from '@/lib/errores';
import { apiCarrito, type Carrito } from './api';
import { useClaveCarrito } from './consultas';
import { panelCarrito } from './panel-carrito';

/**
 * Todas las mutaciones del carrito devuelven el carrito completo ya recalculado por la API:
 * se guarda tal cual en la caché (el frontend nunca recalcula montos).
 */
function useMutacionCarrito<V>(funcion: (variables: V) => Promise<Carrito>, mensajeExito?: string) {
  const cliente = useQueryClient();
  const clave = useClaveCarrito();
  return useMutation({
    mutationFn: funcion,
    onSuccess: (carrito) => {
      cliente.setQueryData(clave, carrito);
      // Si había un checkout activo, la API lo canceló al cambiar el carrito
      void cliente.invalidateQueries({ queryKey: [PREFIJO.checkout] });
      if (mensajeExito) toast.success(mensajeExito);
    },
    onError: (error) => {
      toast.error(mensajeDeError(error));
      // La existencia pudo cambiar: se vuelve a pedir el carrito para mostrar lo real
      void cliente.invalidateQueries({ queryKey: clave });
    },
  });
}

export function useAgregarAlCarrito() {
  const cliente = useQueryClient();
  const clave = useClaveCarrito();
  return useMutation({
    mutationFn: ({ idVariante, cantidad }: { idVariante: number; cantidad: number }) =>
      apiCarrito.agregar(idVariante, cantidad),
    onSuccess: (carrito) => {
      cliente.setQueryData(clave, carrito);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.checkout] });
      panelCarrito.abrir();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
}

export const useCambiarCantidad = () =>
  useMutacionCarrito(({ idVariante, cantidad }: { idVariante: number; cantidad: number }) =>
    apiCarrito.cambiarCantidad(idVariante, cantidad),
  );

export const useQuitarDelCarrito = () =>
  useMutacionCarrito((idVariante: number) => apiCarrito.quitar(idVariante));

export const useVaciarCarrito = () => useMutacionCarrito(() => apiCarrito.vaciar(), 'Vaciaste el carrito');

export const useQuitarCupon = () => useMutacionCarrito(() => apiCarrito.quitarCupon(), 'Quitaste el cupón');

/** El cupón no muestra toast de error: el formulario enseña el motivo exacto debajo del campo. */
export function useAplicarCupon() {
  const cliente = useQueryClient();
  const clave = useClaveCarrito();
  return useMutation({
    mutationFn: (codigo: string) => apiCarrito.aplicarCupon(codigo),
    onSuccess: (carrito) => {
      cliente.setQueryData(clave, carrito);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.checkout] });
      if (carrito.cupon?.aplicado) toast.success(`Cupón ${carrito.cupon.codigo} aplicado`);
    },
  });
}
