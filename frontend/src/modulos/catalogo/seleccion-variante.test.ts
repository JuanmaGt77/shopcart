import { describe, expect, it } from 'vitest';
import {
  atributosDe,
  buscarVariante,
  elegirValor,
  estadoValor,
  seleccionInicial,
} from './seleccion-variante';
import type { Variante } from './tipos';

let siguienteId = 1;
function variante(atributos: Record<string, string>, disponible = 10, activo = true): Variante {
  const id = siguienteId++;
  return {
    idVariante: id,
    sku: `SKU-${id}`,
    precio: 79,
    disponible,
    activo,
    descripcionVariante: null,
    atributos: Object.entries(atributos).map(([nombre, valor]) => ({ nombre, valor })),
  };
}

// Casco: Talla × Color. No existe el XL rojo y el M negro está agotado.
const casco = [
  variante({ Color: 'Negro', Talla: 'S' }),
  variante({ Color: 'Negro', Talla: 'M' }, 0),
  variante({ Color: 'Negro', Talla: 'XL' }),
  variante({ Color: 'Rojo', Talla: 'S' }, 0),
  variante({ Color: 'Rojo', Talla: 'M' }),
  variante({ Color: 'Rojo', Talla: 'L' }, 3, false), // desactivada: no se muestra
];

describe('selector de variantes', () => {
  it('lista los atributos con sus valores en el orden de alta (no alfabético)', () => {
    expect(atributosDe(casco)).toEqual([
      { nombre: 'Color', valores: ['Negro', 'Rojo'] },
      { nombre: 'Talla', valores: ['S', 'M', 'XL'] },
    ]);
  });

  it('encuentra la variante exacta solo con la selección completa', () => {
    expect(buscarVariante(casco, { Color: 'Rojo', Talla: 'M' })?.idVariante).toBe(casco[4]?.idVariante);
    expect(buscarVariante(casco, { Color: 'Rojo' })).toBeUndefined();
    expect(buscarVariante(casco, { Color: 'Rojo', Talla: 'L' })).toBeUndefined();
  });

  it('marca cada valor como disponible, agotado o inexistente según lo ya elegido', () => {
    const seleccion = { Color: 'Rojo', Talla: 'M' };
    expect(estadoValor(casco, seleccion, 'Talla', 'S')).toBe('agotado');
    expect(estadoValor(casco, seleccion, 'Talla', 'M')).toBe('disponible');
    expect(estadoValor(casco, seleccion, 'Talla', 'XL')).toBe('no-existe');
    expect(estadoValor(casco, { Color: 'Negro', Talla: 'M' }, 'Color', 'Rojo')).toBe('disponible');
  });

  it('empieza con la primera variante que tiene unidades', () => {
    expect(seleccionInicial(casco)).toEqual({ Color: 'Negro', Talla: 'S' });
    expect(seleccionInicial(casco, casco[4]?.idVariante)).toEqual({ Color: 'Rojo', Talla: 'M' });
  });

  it('si la combinación no existe, ajusta los demás atributos a una que sí', () => {
    expect(elegirValor(casco, { Color: 'Rojo', Talla: 'M' }, 'Talla', 'XL')).toEqual({
      Color: 'Negro',
      Talla: 'XL',
    });
    expect(elegirValor(casco, { Color: 'Negro', Talla: 'S' }, 'Talla', 'M')).toEqual({
      Color: 'Negro',
      Talla: 'M',
    });
  });

  it('funciona con productos de un solo atributo', () => {
    const aromatizante = [variante({ Aroma: 'Vainilla' }), variante({ Aroma: 'Pino' }, 0)];
    expect(atributosDe(aromatizante)).toEqual([{ nombre: 'Aroma', valores: ['Vainilla', 'Pino'] }]);
    expect(estadoValor(aromatizante, { Aroma: 'Vainilla' }, 'Aroma', 'Pino')).toBe('agotado');
  });
});
