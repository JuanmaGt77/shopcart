import { ErrorNoEncontrado } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import { inventarioRepositorio } from './inventario.repositorio.js';
import type { FiltroExistencias, FiltroKardex, Movimiento } from './inventario.esquemas.js';

export const inventarioServicio = {
  tiposMovimiento: () => inventarioRepositorio.tiposMovimiento(),

  existencias: (filtro: FiltroExistencias) => inventarioRepositorio.existencias(filtro),

  /**
   * Entradas por compra y ajustes. Las reglas (motivo obligatorio, no dejar existencia
   * negativa ni por debajo de lo reservado) las valida el SP con la fila bloqueada.
   */
  async registrarMovimiento(idAccion: number, movimiento: Movimiento) {
    const registrado = await inventarioRepositorio.registrarMovimiento(idAccion, movimiento);
    if (!registrado) throw new ErrorNoEncontrado('La variante no existe.', 'VARIANTE_NO_ENCONTRADA');

    eventosDominio.emit('inventario:cambio', [
      { idVariante: registrado.idVariante, sku: registrado.sku, disponible: registrado.disponible },
    ]);
    return registrado;
  },

  kardex: (filtro: FiltroKardex) => inventarioRepositorio.kardex(filtro),

  conciliacion: (soloDiferencias: boolean) => inventarioRepositorio.conciliacion(soloDiferencias),

  /** Libera las reservas vencidas y avisa a la tienda y a cada cliente afectado. */
  async liberarReservasVencidas() {
    const resultado = await inventarioRepositorio.liberarReservasVencidas();
    if (resultado.variantes.length > 0) eventosDominio.emit('inventario:cambio', resultado.variantes);
    for (const checkout of resultado.checkouts) eventosDominio.emit('checkout:expirado', checkout);
    return resultado;
  },
};
