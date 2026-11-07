/**
 * Lógica del selector de variantes (sin React, para poder probarla).
 *
 * Un producto tiene variantes que combinan atributos (Talla × Color, Viscosidad × Presentación...).
 * El cliente elige un valor por atributo y con eso se encuentra la variante exacta. Las
 * combinaciones que no existen o están agotadas se muestran deshabilitadas.
 */
import type { Variante } from './tipos';

export type Seleccion = Record<string, string>;

export interface OpcionesAtributo {
  nombre: string;
  valores: string[];
}

/** Variantes que se pueden mostrar (activas), en el orden en que se dieron de alta. */
function vigentes(variantes: Variante[]): Variante[] {
  return variantes.filter((v) => v.activo).sort((a, b) => a.idVariante - b.idVariante);
}

/**
 * Atributos del producto con sus valores, en el orden en que aparecen en las variantes dadas de
 * alta primero (así las tallas salen S, M, L, XL y no en orden alfabético).
 */
export function atributosDe(variantes: Variante[]): OpcionesAtributo[] {
  const mapa = new Map<string, string[]>();
  for (const variante of vigentes(variantes)) {
    for (const { nombre, valor } of variante.atributos) {
      const valores = mapa.get(nombre) ?? [];
      if (!valores.includes(valor)) valores.push(valor);
      mapa.set(nombre, valores);
    }
  }
  return [...mapa].map(([nombre, valores]) => ({ nombre, valores }));
}

function coincide(variante: Variante, seleccion: Seleccion): boolean {
  return Object.entries(seleccion).every(([nombre, valor]) =>
    variante.atributos.some((a) => a.nombre === nombre && a.valor === valor),
  );
}

/** La variante que corresponde a la selección completa (un valor por cada atributo). */
export function buscarVariante(variantes: Variante[], seleccion: Seleccion): Variante | undefined {
  const atributos = atributosDe(variantes);
  if (atributos.some((a) => !seleccion[a.nombre])) return undefined;
  return vigentes(variantes).find((v) => coincide(v, seleccion));
}

export type EstadoValor = 'disponible' | 'agotado' | 'no-existe';

/**
 * Cómo se ve un valor dado lo que ya está elegido en los demás atributos:
 * - disponible: existe una variante con ese valor y con unidades,
 * - agotado: existe pero sin unidades,
 * - no-existe: esa combinación no se vende.
 */
export function estadoValor(
  variantes: Variante[],
  seleccion: Seleccion,
  atributo: string,
  valor: string,
): EstadoValor {
  const resto = Object.fromEntries(Object.entries(seleccion).filter(([nombre]) => nombre !== atributo));
  const candidatas = vigentes(variantes).filter((v) => coincide(v, { ...resto, [atributo]: valor }));
  if (candidatas.length === 0) return 'no-existe';
  return candidatas.some((v) => v.disponible > 0) ? 'disponible' : 'agotado';
}

/** Selección inicial: la variante pedida (?variante=) o la primera con unidades. */
export function seleccionInicial(variantes: Variante[], idVariante?: number): Seleccion {
  const lista = vigentes(variantes);
  const elegida =
    lista.find((v) => v.idVariante === idVariante) ?? lista.find((v) => v.disponible > 0) ?? lista[0];
  return Object.fromEntries((elegida?.atributos ?? []).map((a) => [a.nombre, a.valor]));
}

/**
 * Al cambiar un valor: si con los demás atributos ya no existe esa combinación, se ajustan los
 * otros a la primera variante que sí tenga ese valor (preferentemente con unidades).
 */
export function elegirValor(
  variantes: Variante[],
  seleccion: Seleccion,
  atributo: string,
  valor: string,
): Seleccion {
  const deseada = { ...seleccion, [atributo]: valor };
  if (buscarVariante(variantes, deseada)) return deseada;
  const conValor = vigentes(variantes).filter((v) => coincide(v, { [atributo]: valor }));
  const mejor = conValor.find((v) => v.disponible > 0) ?? conValor[0];
  return mejor ? Object.fromEntries(mejor.atributos.map((a) => [a.nombre, a.valor])) : deseada;
}
