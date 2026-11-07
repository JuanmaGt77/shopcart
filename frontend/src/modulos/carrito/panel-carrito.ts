import { useSyncExternalStore } from 'react';

/** Si el panel lateral del carrito está abierto. Lo abren el ícono del encabezado y "Agregar al carrito". */
let abierto = false;
const oyentes = new Set<() => void>();

export const panelCarrito = {
  abrir() {
    abierto = true;
    for (const oyente of oyentes) oyente();
  },
  cambiar(valor: boolean) {
    abierto = valor;
    for (const oyente of oyentes) oyente();
  },
};

export function usePanelCarritoAbierto(): boolean {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    () => abierto,
  );
}
