import { describe, expect, it } from 'vitest';
import { formatearFecha, formatearFechaHora, formatearQuetzales } from './formato';

describe('formatearQuetzales', () => {
  it('muestra la Q, separador de miles y dos decimales', () => {
    expect(formatearQuetzales(1234.5)).toBe('Q1,234.50');
    expect(formatearQuetzales(0)).toBe('Q0.00');
  });

  it('pone el signo antes de la Q en montos negativos', () => {
    expect(formatearQuetzales(-50)).toBe('-Q50.00');
  });
});

describe('fechas en hora de Guatemala (UTC-6)', () => {
  it('una venta a las 03:00 UTC cuenta en el día anterior de Guatemala', () => {
    expect(formatearFecha('2026-11-08T03:00:00Z')).toBe('7 nov 2026');
  });

  it('convierte la hora UTC a la hora local', () => {
    expect(formatearFechaHora('2026-11-07T17:36:00Z')).toContain('11:36');
  });
});
