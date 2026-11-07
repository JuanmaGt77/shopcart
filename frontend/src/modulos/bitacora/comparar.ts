export interface FilaComparacion {
  campo: string;
  antes: string;
  despues: string;
  cambio: boolean;
}

function aTexto(valor: unknown): string {
  if (valor === undefined) return '—';
  if (valor === null) return 'vacío';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/**
 * Valor anterior contra valor nuevo de un registro de la bitácora (JSON guardado por los triggers),
 * campo por campo. Los campos que cambiaron se marcan para resaltarlos.
 */
export function compararValores(anterior: unknown, nuevo: unknown): FilaComparacion[] {
  const a = comoObjeto(anterior);
  const n = comoObjeto(nuevo);
  if (!a && !n) {
    return [
      {
        campo: 'valor',
        antes: aTexto(anterior),
        despues: aTexto(nuevo),
        cambio: aTexto(anterior) !== aTexto(nuevo),
      },
    ];
  }
  const campos = [...new Set([...Object.keys(a ?? {}), ...Object.keys(n ?? {})])];
  return campos.map((campo) => {
    const antes = aTexto(a?.[campo]);
    const despues = aTexto(n?.[campo]);
    return { campo, antes, despues, cambio: antes !== despues };
  });
}
