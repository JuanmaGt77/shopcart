import { describe, expect, it } from 'vitest';
import { finDelDia, haceDias, hoyGuatemala, inicioDelDia } from './fechas';

describe('fechas del panel', () => {
  it('convierte un día en el rango completo de ese día en Guatemala', () => {
    expect(inicioDelDia('2026-11-07')).toBe('2026-11-07T00:00:00-06:00');
    expect(finDelDia('2026-11-07')).toBe('2026-11-07T23:59:59-06:00');
    expect(inicioDelDia(undefined)).toBeUndefined();
  });

  it('calcula "hoy" con la hora de Guatemala, no la UTC', () => {
    // 8 nov 03:00 UTC todavía es 7 nov en Guatemala
    expect(hoyGuatemala(new Date('2026-11-08T03:00:00Z'))).toBe('2026-11-07');
    expect(haceDias(30, new Date('2026-11-07T18:00:00Z'))).toBe('2026-10-08');
  });
});
