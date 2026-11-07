/**
 * Exportación a CSV (Excel lo abre directo). Se arma en el navegador con los datos que ya
 * devolvió la API: no hay cálculos nuevos, solo se escriben las mismas cifras.
 */
export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

/**
 * Un nombre de producto o de cliente que empiece con = + - @ (o tabulador) se tomaría como
 * fórmula al abrir el archivo en Excel ("inyección de CSV"). Se antepone un apóstrofo para que
 * quede como texto. Los números no pasan por aquí: un monto negativo sigue siendo número.
 */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  const texto = neutralizarFormula(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Texto CSV con encabezados. Empieza con BOM para que Excel respete las tildes (UTF-8). */
export function aCsv<T>(columnas: ColumnaCsv<T>[], filas: T[]): string {
  const lineas = [
    columnas.map((c) => celda(c.titulo)).join(','),
    ...filas.map((fila) => columnas.map((c) => celda(c.valor(fila))).join(',')),
  ];
  return `﻿${lineas.join('\r\n')}\r\n`;
}

export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
