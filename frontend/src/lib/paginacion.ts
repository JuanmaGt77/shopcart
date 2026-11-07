/** Números a mostrar: siempre la primera, la última y dos alrededor de la actual; "…" en los huecos. */
export function paginasVisibles(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas = new Set([1, total, actual - 1, actual, actual + 1].filter((p) => p >= 1 && p <= total));
  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado: (number | '…')[] = [];
  ordenadas.forEach((pagina, i) => {
    const anterior = ordenadas[i - 1];
    if (anterior !== undefined && pagina - anterior > 1) resultado.push('…');
    resultado.push(pagina);
  });
  return resultado;
}
