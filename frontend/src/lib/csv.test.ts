import { describe, expect, it } from 'vitest';
import { aCsv } from './csv';

const columnas = [
  { titulo: 'Producto', valor: (f: { nombre: string; monto: number }) => f.nombre },
  { titulo: 'Monto', valor: (f: { nombre: string; monto: number }) => f.monto },
];

describe('exportación a CSV', () => {
  it('empieza con BOM para que Excel lea las tildes y separa filas con CRLF', () => {
    const csv = aCsv(columnas, [{ nombre: 'Aceite sintético', monto: 329 }]);
    expect(csv).toBe('﻿Producto,Monto\r\nAceite sintético,329\r\n');
  });

  it('pone entre comillas los textos con comas, comillas o saltos de línea', () => {
    const csv = aCsv(columnas, [{ nombre: 'Playera "En ruta", talla M', monto: 79.5 }]);
    expect(csv).toContain('"Playera ""En ruta"", talla M",79.5');
  });

  it('neutraliza textos que Excel tomaría como fórmula (inyección de CSV)', () => {
    const csv = aCsv(columnas, [
      { nombre: '=HYPERLINK("http://malicioso")', monto: 1 },
      { nombre: '+50', monto: -50 },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://malicioso"")",1`);
    expect(csv).toContain("'+50,-50");
  });
});
