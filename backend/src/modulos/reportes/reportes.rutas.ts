import type { Response } from 'express';
import { Modulo } from '../../compartido/http/modulo.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import { SOLO_ADMIN } from '../../compartido/http/tipos.js';
import type { ResultadoPaginado } from '../../db/ejecutor.js';
import {
  carritosAbandonadosEsquema,
  rangoEsquema,
  topProductosEsquema,
  ventasEsquema,
} from './reportes.esquemas.js';
import { reportesServicio, type ConFuente } from './reportes.servicio.js';

/** X-Cache: HIT si salió de la caché, MISS si se consultó la base. */
function conEncabezadoCache<T>(res: Response, resultado: ConFuente<T>) {
  res.setHeader('X-Cache', resultado.desdeCache ? 'HIT' : 'MISS');
  return resultado.datos;
}

const nota =
  'Solo cuenta pedidos que no están cancelados ni devueltos por completo, y siempre resta lo devuelto. Fechas en días de Guatemala; sin fechas toma los últimos 30 días. Respuesta con caché (encabezado X-Cache) que se invalida con cada venta, cancelación o devolución.';

export function rutasReportes(): Modulo {
  return new Modulo('/api/reportes', 'Dashboard y reportes')
    .ruta({
      metodo: 'get',
      ruta: '/resumen',
      resumen: 'Indicadores: ventas netas, pedidos, ticket promedio, unidades, carritos abandonados, existencia baja',
      descripcion: nota,
      acceso: SOLO_ADMIN,
      query: rangoEsquema,
      manejador: async ({ query, res }) => respuesta(conEncabezadoCache(res, await reportesServicio.resumen(query))),
    })
    .ruta({
      metodo: 'get',
      ruta: '/ventas',
      resumen: 'Ventas por día, semana o mes (quetzales y número de pedidos)',
      descripcion: nota + ' Incluye los periodos sin ventas en cero para que la gráfica no tenga huecos.',
      acceso: SOLO_ADMIN,
      query: ventasEsquema,
      manejador: async ({ query, res }) =>
        respuesta(conEncabezadoCache(res, await reportesServicio.ventasPorPeriodo(query.agrupacion, query))),
    })
    .ruta({
      metodo: 'get',
      ruta: '/ventas-por-categoria',
      resumen: 'Ventas por categoría con su porcentaje del total',
      descripcion: nota,
      acceso: SOLO_ADMIN,
      query: rangoEsquema,
      manejador: async ({ query, res }) =>
        respuesta(conEncabezadoCache(res, await reportesServicio.ventasPorCategoria(query))),
    })
    .ruta({
      metodo: 'get',
      ruta: '/top-productos',
      resumen: 'Productos más vendidos de un periodo (10 por defecto)',
      descripcion: nota,
      acceso: SOLO_ADMIN,
      query: topProductosEsquema,
      manejador: async ({ query, res }) =>
        respuesta(conEncabezadoCache(res, await reportesServicio.topProductos(query.limite, query))),
    })
    .ruta({
      metodo: 'get',
      ruta: '/carritos-abandonados',
      resumen: 'Carritos con productos y sin actividad',
      descripcion: 'Las horas de inactividad salen del parámetro HORAS_CARRITO_ABANDONADO (24 por defecto) o del filtro "horas".',
      acceso: SOLO_ADMIN,
      query: carritosAbandonadosEsquema,
      manejador: async ({ query, res }) => {
        const resultado = conEncabezadoCache(
          res,
          await reportesServicio.carritosAbandonados(query.horas, query.pagina, query.tamanoPagina),
        ) as ResultadoPaginado<unknown>;
        return { datos: resultado.items, paginacion: resultado.paginacion };
      },
    });
}
