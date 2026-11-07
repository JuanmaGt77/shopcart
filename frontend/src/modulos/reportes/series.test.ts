import { describe, expect, it } from 'vitest';
import { completarDias, etiquetaPeriodo, quetzalesCompactos } from './series';

describe('serie de ventas', () => {
  it('agrega con cero los días sin ventas para no unir días lejanos', () => {
    const puntos = [
      { periodo: '2026-11-01', pedidos: 2, montoVendido: 300, ticketPromedio: 150 },
      { periodo: '2026-11-04', pedidos: 1, montoVendido: 79, ticketPromedio: 79 },
    ];
    const serie = completarDias(puntos, '2026-11-01', '2026-11-04');
    expect(serie.map((p) => [p.periodo, p.montoVendido])).toEqual([
      ['2026-11-01', 300],
      ['2026-11-02', 0],
      ['2026-11-03', 0],
      ['2026-11-04', 79],
    ]);
  });

  it('nombra cada periodo según la agrupación', () => {
    expect(etiquetaPeriodo('2026-10-05', 'dia')).toBe('5 oct');
    expect(etiquetaPeriodo('2026-10-05', 'semana')).toBe('sem. 5 oct');
    expect(etiquetaPeriodo('2026-10-01', 'mes')).toMatch(/oct.*2026/);
  });

  it('compacta los montos del eje', () => {
    expect(quetzalesCompactos(0)).toBe('Q0');
    expect(quetzalesCompactos(1500)).toBe('Q1.5K');
    expect(quetzalesCompactos(64185)).toBe('Q64.2K');
  });
});
