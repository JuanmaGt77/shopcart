/**
 * Generador de variantes para el alta de productos: con "Talla: S, M, L" y "Color: Negro, Rojo"
 * arma las 6 combinaciones con un SKU sugerido (que el administrador puede corregir).
 * El SKU solo admite A-Z, 0-9 y guiones (igual que la API y el CHECK de la tabla Variante).
 */

export interface AtributoEntrada {
  nombre: string;
  valores: string[];
}

export interface VarianteNueva {
  sku: string;
  precio: number;
  existenciaInicial: number;
  atributos: Record<string, string>;
}

/** "¼ galón" -> "025GALON", "5W-30" -> "5W30", "Limón y sal" -> "LIMONYSAL" */
export function codigoParaSku(valor: string): string {
  return valor
    .replace(/¼/g, '025')
    .replace(/½/g, '05')
    .replace(/×/g, 'X')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** "Talla: S, M , L" escrito por el usuario -> ["S", "M", "L"] sin vacíos ni repetidos */
export function separarValores(texto: string): string[] {
  return [
    ...new Set(
      texto
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

/** Producto cartesiano de los valores de cada atributo, en el orden en que se escribieron. */
export function generarCombinaciones(
  atributos: AtributoEntrada[],
  prefijo: string,
  precio: number,
  existenciaInicial: number,
): VarianteNueva[] {
  const validos = atributos.filter((a) => a.nombre.trim() && a.valores.length > 0);
  let combinaciones: Record<string, string>[] = [{}];
  for (const atributo of validos) {
    combinaciones = combinaciones.flatMap((c) =>
      atributo.valores.map((v) => ({ ...c, [atributo.nombre.trim()]: v })),
    );
  }
  const base = codigoParaSku(prefijo).slice(0, 12) || 'SKU';
  return combinaciones.map((atributosVariante) => {
    const partes = Object.values(atributosVariante).map(codigoParaSku).filter(Boolean);
    return {
      sku: [base, ...partes].join('-').slice(0, 40),
      precio,
      existenciaInicial,
      atributos: atributosVariante,
    };
  });
}
