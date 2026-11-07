import type { Agrupacion, PuntoVentas } from './api';

/**
 * La API solo devuelve los días que tuvieron ventas. Para una línea de tiempo honesta, los días
 * sin ventas se agregan con cero (si no, la línea uniría dos días lejanos como si fueran seguidos).
 * No es aritmética de dinero: solo se insertan puntos vacíos.
 */
export function completarDias(puntos: PuntoVentas[], desde: string, hasta: string): PuntoVentas[] {
  const porDia = new Map(puntos.map((p) => [p.periodo.slice(0, 10), p]));
  const resultado: PuntoVentas[] = [];
  const fin = new Date(`${hasta}T00:00:00Z`);
  for (let dia = new Date(`${desde}T00:00:00Z`); dia <= fin; dia.setUTCDate(dia.getUTCDate() + 1)) {
    const clave = dia.toISOString().slice(0, 10);
    resultado.push(porDia.get(clave) ?? { periodo: clave, pedidos: 0, montoVendido: 0, ticketPromedio: 0 });
    if (resultado.length > 400) break;
  }
  return resultado;
}

const formatos = {
  dia: new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', day: 'numeric', month: 'short' }),
  mes: new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', month: 'short', year: 'numeric' }),
  largo: new Intl.DateTimeFormat('es-GT', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }),
};

/** "2026-10-05" -> "5 oct" (día), "sem. 5 oct" (semana), "oct 2026" (mes). */
export function etiquetaPeriodo(periodo: string, agrupacion: Agrupacion, largo = false): string {
  const fecha = new Date(`${periodo.slice(0, 10)}T12:00:00Z`);
  if (agrupacion === 'mes') return formatos.mes.format(fecha);
  if (agrupacion === 'semana') return `${largo ? 'Semana del' : 'sem.'} ${formatos.dia.format(fecha)}`;
  return largo ? formatos.largo.format(fecha) : formatos.dia.format(fecha);
}

const compacto = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Eje en quetzales: Q0, Q500, Q1.5K, Q12K */
export function quetzalesCompactos(monto: number): string {
  return `Q${compacto.format(monto)}`;
}
