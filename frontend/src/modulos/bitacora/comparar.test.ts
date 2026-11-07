import { describe, expect, it } from 'vitest';
import { compararValores } from './comparar';

describe('comparar valores de la bitácora', () => {
  it('lista cada campo y marca los que cambiaron', () => {
    const filas = compararValores(
      { sku: 'LUBSIN-5W30-1G', precio: 329 },
      { sku: 'LUBSIN-5W30-1G', precio: 299 },
    );
    expect(filas).toEqual([
      { campo: 'sku', antes: 'LUBSIN-5W30-1G', despues: 'LUBSIN-5W30-1G', cambio: false },
      { campo: 'precio', antes: '329', despues: '299', cambio: true },
    ]);
  });

  it('una creación no tiene valor anterior', () => {
    expect(compararValores(null, { codigo: 'MOTO20' })).toEqual([
      { campo: 'codigo', antes: '—', despues: 'MOTO20', cambio: true },
    ]);
  });
});
