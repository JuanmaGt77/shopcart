import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
import { mensajeDeError } from '@/lib/errores';
import { apiCarrito, type Carrito } from './api';
import { useClaveCarrito } from './consultas';
import { panelCarrito } from './panel-carrito';

/**
 * Guarda el carrito que devolvió la API. Antes cancela cualquier GET /carrito en curso: el aviso
 * de inventario por WebSocket puede llegar antes que esta respuesta y disparar una consulta que,
 * si terminara después, pisaría el carrito nuevo con uno viejo (o vacío, en el primer producto
 * de un invitado, cuando todavía no tenía token).
 */
async function guardarCarrito(cliente: QueryClient, clave: readonly unknown[], carrito: Carrito) {
  await cliente.cancelQueries({ queryKey: clave });
  cliente.setQueryData(clave, carrito);
  // Si había un checkout activo, la API lo canceló al cambiar el carrito
  void cliente.invalidateQueries({ queryKey: [PREFIJO.checkout] });
}

/**
 * Todas las mutaciones del carrito devuelven el carrito completo ya recalculado por la API:
 * se guarda tal cual en la caché (el frontend nunca recalcula montos).
 */
function useMutacionCarrito<V>(funcion: (variables: V) => Promise<Carrito>, mensajeExito?: string) {
  const cliente = useQueryClient();
  const clave = useClaveCarrito();
  return useMutation({
    mutationFn: funcion,
    onSuccess: async (carrito) => {
      await guardarCarrito(cliente, clave, carrito);
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
    onSuccess: async (carrito) => {
      await guardarCarrito(cliente, clave, carrito);
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
    onSuccess: async (carrito) => {
      await guardarCarrito(cliente, clave, carrito);
      if (carrito.cupon?.aplicado) toast.success(`Cupón ${carrito.cupon.codigo} aplicado`);
    },
  });
}
