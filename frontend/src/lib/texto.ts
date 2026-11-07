/** "María José", "López" -> "ML" (para los avatares). */
export function iniciales(nombres: string, apellidos: string): string {
  return `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase();
}

/** 1 -> "1 artículo", 3 -> "3 artículos" */
export function plural(cantidad: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}
