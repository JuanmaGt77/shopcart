import { describe, expect, it } from 'vitest';
import { codigoParaSku, generarCombinaciones, separarValores } from './combinaciones';

describe('generador de variantes', () => {
  it('convierte un valor en un código válido para el SKU', () => {
    expect(codigoParaSku('¼ galón')).toBe('025GALON');
    expect(codigoParaSku('5W-30')).toBe('5W30');
    expect(codigoParaSku('Limón y sal')).toBe('LIMONYSAL');
    expect(codigoParaSku('40×40 cm')).toBe('40X40CM');
  });

  it('separa los valores escritos con comas sin vacíos ni repetidos', () => {
    expect(separarValores(' S, M ,, L, M ')).toEqual(['S', 'M', 'L']);
  });

  it('arma todas las combinaciones en el orden escrito', () => {
    const variantes = generarCombinaciones(
      [
        { nombre: 'Viscosidad', valores: ['5W-30', '10W-40'] },
        { nombre: 'Presentación', valores: ['¼ galón', '1 galón'] },
      ],
      'lubsin',
      95,
      10,
    );
    expect(variantes.map((v) => v.sku)).toEqual([
      'LUBSIN-5W30-025GALON',
      'LUBSIN-5W30-1GALON',
      'LUBSIN-10W40-025GALON',
      'LUBSIN-10W40-1GALON',
    ]);
    expect(variantes[0]).toMatchObject({
      precio: 95,
      existenciaInicial: 10,
      atributos: { Viscosidad: '5W-30', Presentación: '¼ galón' },
    });
    expect(variantes.every((v) => /^[A-Z0-9-]{3,40}$/.test(v.sku))).toBe(true);
  });

  it('sin atributos genera una sola variante', () => {
    expect(generarCombinaciones([], 'Gorra', 65, 5)).toEqual([
      { sku: 'GORRA', precio: 65, existenciaInicial: 5, atributos: {} },
    ]);
  });
});
