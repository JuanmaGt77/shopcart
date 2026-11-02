import { consultarLista, consultarPaginado, ejecutarSP, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { Rango } from './reportes.esquemas.js';

const fechas = (r: Rango) => [p.fecha('Desde', r.desde), p.fecha('Hasta', r.hasta)];

export const reportesRepositorio = {
  async resumen(r: Rango) {
    const [kpis = [], porEstado = []] = await ejecutarSP(SP.Dashboard.Resumen, fechas(r));
    return { ...(kpis[0] ?? {}), pedidosPorEstado: porEstado };
  },

  ventasPorPeriodo: (agrupacion: 'dia' | 'semana' | 'mes', r: Rango) =>
    consultarLista<Fila>(SP.Dashboard.VentasPorPeriodo, [p.ascii('Agrupacion', 6, agrupacion.toUpperCase()), ...fechas(r)]),

  ventasPorCategoria: (r: Rango) => consultarLista<Fila>(SP.Dashboard.VentasPorCategoria, fechas(r)),

  topProductos: (limite: number, r: Rango) =>
    consultarLista<Fila>(SP.Dashboard.TopProductos, [...fechas(r), p.entero('Limite', limite)]),

  carritosAbandonados: (horas: number | undefined, pagina: number, tamanoPagina: number) =>
    consultarPaginado<Fila>(
      SP.Dashboard.CarritosAbandonados,
      [p.entero('Horas', horas), p.entero('Pagina', pagina), p.entero('TamanoPagina', tamanoPagina)],
      pagina,
      tamanoPagina,
    ),
};
