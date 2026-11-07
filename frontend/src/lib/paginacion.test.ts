import { describe, expect, it } from 'vitest';
import { paginasVisibles } from './paginacion';

describe('paginasVisibles', () => {
  it('muestra todas cuando son pocas', () => {
    expect(paginasVisibles(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('resume con … alrededor de la página actual', () => {
    expect(paginasVisibles(1, 20)).toEqual([1, 2, '…', 20]);
    expect(paginasVisibles(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
    expect(paginasVisibles(20, 20)).toEqual([1, '…', 19, 20]);
  });
});
