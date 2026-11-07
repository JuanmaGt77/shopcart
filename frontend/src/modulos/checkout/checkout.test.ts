import { describe, expect, it } from 'vitest';
import { ErrorApi } from '@/api/cliente';
import { intentoTerminado, nuevaClaveIdempotencia } from './idempotencia';
import { expiracionVigente, formatearExpiracion, formatearNumeroTarjeta, luhnValido } from './tarjeta';

describe('tarjeta', () => {
  it('valida el dígito verificador (Luhn)', () => {
    expect(luhnValido('4111 1111 1111 1111')).toBe(true);
    expect(luhnValido('4000 0000 0000 0002')).toBe(true);
    expect(luhnValido('4111 1111 1111 1112')).toBe(false);
    expect(luhnValido('1234')).toBe(false);
  });

  it('da formato al número y a la fecha mientras se escribe', () => {
    expect(formatearNumeroTarjeta('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatearNumeroTarjeta('4111-1111 abc')).toBe('4111 1111');
    expect(formatearExpiracion('1228')).toBe('12/28');
    expect(formatearExpiracion('1')).toBe('1');
  });

  it('una tarjeta vale hasta el último día de su mes', () => {
    const hoy = new Date(2026, 10, 7); // 7 nov 2026
    expect(expiracionVigente('11/26', hoy)).toBe(true);
    expect(expiracionVigente('10/26', hoy)).toBe(false);
    expect(expiracionVigente('13/30', hoy)).toBe(false);
  });
});

describe('clave de idempotencia', () => {
  it('genera claves distintas con el formato que acepta la API', () => {
    const a = nuevaClaveIdempotencia();
    const b = nuevaClaveIdempotencia();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  it('se reusa si no sabemos si el cobro se hizo (sin red o error del servidor)', () => {
    expect(intentoTerminado(new ErrorApi(0, 'SIN_CONEXION', 'sin red'))).toBe(false);
    expect(intentoTerminado(new ErrorApi(503, 'BASE_DATOS_NO_DISPONIBLE', 'caída'))).toBe(false);
  });

  it('se cambia solo cuando la API ya rechazó el intento', () => {
    expect(intentoTerminado(new ErrorApi(402, 'PAGO_RECHAZADO', 'rechazada'))).toBe(true);
    expect(intentoTerminado(new ErrorApi(409, 'RESERVA_EXPIRADA', 'venció'))).toBe(true);
  });
});
