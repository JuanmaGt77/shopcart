import { CacheTTL } from '../../compartido/cache.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import { reportesRepositorio } from './reportes.repositorio.js';
import type { Rango } from './reportes.esquemas.js';

/**
 * Caché de reportes con invalidación por eventos.
 * - Cada reporte se guarda hasta 5 minutos con una clave que incluye sus filtros.
 * - En cuanto algo cambia las ventas (pedido nuevo, cancelación, devolución, cambio
 *   de estado) la caché se vacía completa, así nunca se muestra un dato viejo.
 * - Los carritos abandonados dependen de la actividad de los carritos, así que
 *   también se invalidan cuando cambia algún carrito.
 */
const cache = new CacheTTL<unknown>(5 * 60 * 1000, 500);

eventosDominio.on('ventas:cambiaron', () => cache.limpiar());
eventosDominio.on('carrito:cambio', () => cache.eliminarPorPrefijo('carritos|'));

export interface ConFuente<T> {
  datos: T;
  desdeCache: boolean;
}

async function conCache<T>(clave: string, cargar: () => Promise<T>): Promise<ConFuente<T>> {
  const guardado = cache.obtener(clave) as T | undefined;
  if (guardado !== undefined) return { datos: guardado, desdeCache: true };
  const datos = await cargar();
  cache.guardar(clave, datos);
  return { datos, desdeCache: false };
}

const claveRango = (r: Rango) => `${r.desde ?? ''}|${r.hasta ?? ''}`;

export const reportesServicio = {
  resumen: (r: Rango) => conCache(`resumen|${claveRango(r)}`, () => reportesRepositorio.resumen(r)),

  ventasPorPeriodo: (agrupacion: 'dia' | 'semana' | 'mes', r: Rango) =>
    conCache(`ventas|${agrupacion}|${claveRango(r)}`, () => reportesRepositorio.ventasPorPeriodo(agrupacion, r)),

  ventasPorCategoria: (r: Rango) =>
    conCache(`categorias|${claveRango(r)}`, () => reportesRepositorio.ventasPorCategoria(r)),

  topProductos: (limite: number, r: Rango) =>
    conCache(`top|${limite}|${claveRango(r)}`, () => reportesRepositorio.topProductos(limite, r)),

  carritosAbandonados: (horas: number | undefined, pagina: number, tamanoPagina: number) =>
    conCache(`carritos|${horas ?? ''}|${pagina}|${tamanoPagina}`, () =>
      reportesRepositorio.carritosAbandonados(horas, pagina, tamanoPagina),
    ),

  /** Solo para pruebas y demos: ver cuántos reportes hay guardados. */
  tamanoCache: () => cache.tamano,
};
