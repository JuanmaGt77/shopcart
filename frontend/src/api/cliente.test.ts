import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { almacenSesion } from '@/modulos/auth/almacen-sesion';
import type { Usuario } from '@/modulos/auth/tipos';
import { ErrorApi, pedir } from './cliente';

const usuario: Usuario = {
  idUsuario: 7,
  correo: 'cliente@shopcart.test',
  nombres: 'Ana',
  apellidos: 'López',
  telefono: null,
  rol: 'CLIENTE',
  activo: true,
  fechaCreacion: '2026-11-01T00:00:00Z',
  fechaUltimoAcceso: null,
};

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

describe('cliente HTTP', () => {
  let renovaciones = 0;

  beforeEach(() => {
    renovaciones = 0;
    almacenSesion.establecer({ usuario, accessToken: 'token-viejo', expiraEn: 900 });
  });

  afterEach(() => {
    almacenSesion.limpiar('manual');
    vi.unstubAllGlobals();
  });

  it('con varias peticiones vencidas a la vez renueva el token UNA sola vez y las repite', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url === '/api/auth/refresh') {
          renovaciones++;
          await new Promise((r) => setTimeout(r, 20));
          return json(200, { datos: { usuario, accessToken: 'token-nuevo', expiraEn: 900 } });
        }
        const autorizacion = new Headers(init.headers).get('Authorization');
        if (autorizacion === 'Bearer token-viejo') {
          return json(401, { error: { codigo: 'TOKEN_EXPIRADO', mensaje: 'El token venció' } });
        }
        return json(200, { datos: url });
      }),
    );

    const respuestas = await Promise.all([pedir('/pedidos/mios'), pedir('/direcciones'), pedir('/carrito')]);

    expect(respuestas).toEqual(['/api/pedidos/mios', '/api/direcciones', '/api/carrito']);
    expect(renovaciones).toBe(1);
    expect(almacenSesion.token()).toBe('token-nuevo');
  });

  it('si la cuenta fue desactivada, cierra la sesión y lanza el error de la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(401, { error: { codigo: 'SESION_REVOCADA', mensaje: 'Tu cuenta fue desactivada.' } }),
      ),
    );

    await expect(pedir('/pedidos/mios')).rejects.toMatchObject({ codigo: 'SESION_REVOCADA', estado: 401 });
    expect(almacenSesion.obtener()).toMatchObject({ estado: 'anonimo', motivoCierre: 'revocada' });
  });

  it('expone los errores de validación por campo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, {
          error: {
            codigo: 'VALIDACION',
            mensaje: 'Datos inválidos',
            detalles: [{ campo: 'correo', mensaje: 'El correo no es válido' }],
          },
        }),
      ),
    );

    const error = await pedir('/auth/registro', { metodo: 'POST', cuerpo: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).erroresDeCampo).toEqual([
      { campo: 'correo', mensaje: 'El correo no es válido' },
    ]);
  });

  it('arma la consulta sin los filtros vacíos', async () => {
    const fetchFalso = vi.fn(async () => json(200, { datos: [] }));
    vi.stubGlobal('fetch', fetchFalso);

    await pedir('/productos', { consulta: { q: 'aceite', idCategoria: 4, precioMin: undefined, marca: '' } });
    expect(fetchFalso).toHaveBeenCalledWith('/api/productos?q=aceite&idCategoria=4', expect.anything());
  });
});
