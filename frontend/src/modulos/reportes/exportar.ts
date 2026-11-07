import { aCsv, descargarCsv } from '@/lib/csv';
import type { Agrupacion, ProductoTop, PuntoVentas, Rango, VentaCategoria } from './api';

/** Exporta a CSV exactamente lo que muestra el dashboard (las cifras ya vienen calculadas por la API). */
const sufijo = (rango: Rango) => `${rango.desde}_a_${rango.hasta}`;

export function exportarVentas(serie: PuntoVentas[], agrupacion: Agrupacion, rango: Rango) {
  const nombre = { dia: 'dia', semana: 'semana', mes: 'mes' }[agrupacion];
  descargarCsv(
    `ventas-por-${nombre}_${sufijo(rango)}`,
    aCsv(
      [
        {
          titulo: agrupacion === 'dia' ? 'Día' : agrupacion === 'semana' ? 'Semana (inicio)' : 'Mes',
          valor: (p) => p.periodo.slice(0, 10),
        },
        { titulo: 'Pedidos', valor: (p) => p.pedidos },
        { titulo: 'Ventas netas (Q)', valor: (p) => p.montoVendido },
        { titulo: 'Ticket promedio (Q)', valor: (p) => p.ticketPromedio },
      ],
      serie,
    ),
  );
}

export function exportarCategorias(datos: VentaCategoria[], rango: Rango) {
  descargarCsv(
    `ventas-por-categoria_${sufijo(rango)}`,
    aCsv(
      [
        { titulo: 'Categoría', valor: (c) => c.categoria },
        { titulo: 'Unidades', valor: (c) => c.unidades },
        { titulo: 'Pedidos', valor: (c) => c.pedidos },
        { titulo: 'Ventas netas (Q)', valor: (c) => c.monto },
        { titulo: '% de las ventas', valor: (c) => c.porcentaje },
      ],
      [...datos].sort((a, b) => b.monto - a.monto),
    ),
  );
}

export function exportarTopProductos(datos: ProductoTop[], rango: Rango) {
  descargarCsv(
    `top-productos_${sufijo(rango)}`,
    aCsv(
      [
        { titulo: 'Posición', valor: (p) => Number(p.posicion) },
        { titulo: 'Producto', valor: (p) => p.producto },
        { titulo: 'Categoría', valor: (p) => p.categoria },
        { titulo: 'Unidades', valor: (p) => p.unidades },
        { titulo: 'Pedidos', valor: (p) => p.pedidos },
        { titulo: 'Ventas netas (Q)', valor: (p) => p.monto },
      ],
      datos,
    ),
  );
}
