/**
 * Los filtros de fecha del panel usan <input type="date"> (AAAA-MM-DD). Algunos endpoints reciben
 * el día tal cual (pedidos, reportes) y otros una fecha y hora con zona (kardex, bitácora):
 * en ese caso se manda el día completo en hora de Guatemala (UTC-6).
 */
export function inicioDelDia(dia: string | undefined): string | undefined {
  return dia ? `${dia}T00:00:00-06:00` : undefined;
}

export function finDelDia(dia: string | undefined): string | undefined {
  return dia ? `${dia}T23:59:59-06:00` : undefined;
}

/** Hoy en Guatemala como AAAA-MM-DD. */
export function hoyGuatemala(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(ahora);
}

/** AAAA-MM-DD de hace `dias` días (en Guatemala). */
export function haceDias(dias: number, ahora = new Date()): string {
  return hoyGuatemala(new Date(ahora.getTime() - dias * 86_400_000));
}
