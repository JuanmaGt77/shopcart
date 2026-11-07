import { describe, expect, it } from 'vitest';
import { destinoDespuesDeLogin } from './destino';

describe('destinoDespuesDeLogin', () => {
  it('regresa al cliente a la página donde estaba', () => {
    expect(destinoDespuesDeLogin('CLIENTE', '/checkout')).toBe('/checkout');
    expect(destinoDespuesDeLogin('CLIENTE', null)).toBe('/');
  });

  it('nunca redirige fuera de la tienda', () => {
    expect(destinoDespuesDeLogin('CLIENTE', '//sitio-malicioso.com')).toBe('/');
    expect(destinoDespuesDeLogin('CLIENTE', 'https://sitio-malicioso.com')).toBe('/');
    expect(destinoDespuesDeLogin('ADMIN', '//sitio-malicioso.com')).toBe('/panel');
  });

  it('manda al personal a su panel y al cliente fuera del panel', () => {
    expect(destinoDespuesDeLogin('ADMIN', null)).toBe('/panel');
    expect(destinoDespuesDeLogin('OPERADOR', '/')).toBe('/panel/pedidos');
    expect(destinoDespuesDeLogin('OPERADOR', '/panel/inventario')).toBe('/panel/inventario');
    expect(destinoDespuesDeLogin('CLIENTE', '/panel/usuarios')).toBe('/');
  });
});
