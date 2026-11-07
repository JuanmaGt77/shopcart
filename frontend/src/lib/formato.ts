/**
 * Formatos de la tienda. La API manda montos ya calculados en SQL Server (DECIMAL): aquí solo
 * se muestran, nunca se suman ni se multiplican. Las fechas llegan en UTC y se muestran en
 * hora de Guatemala.
 */

const ZONA_HORARIA = 'America/Guatemala';

const numero = new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_HORARIA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const fechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_HORARIA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** 1234.5 -> "Q1,234.50" (como se escribe en Guatemala, sin espacio después de la Q) */
export function formatearQuetzales(monto: number): string {
  const texto = `Q${numero.format(Math.abs(monto))}`;
  return monto < 0 ? `-${texto}` : texto;
}

/** "2026-11-07T17:36:20Z" -> "7 nov 2026" (día de Guatemala) */
export function formatearFecha(valor: string | Date): string {
  return fecha.format(new Date(valor));
}

/** "2026-11-07T17:36:20Z" -> "7 nov 2026, 11:36 a. m." (hora de Guatemala) */
export function formatearFechaHora(valor: string | Date): string {
  return fechaHora.format(new Date(valor));
}
