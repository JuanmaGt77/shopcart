import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { CREDENCIALES, api, iniciarSesion, nuevoCliente, tokenAdmin } from './ayudantes.js';

describe('Sin SQL en el código del backend', () => {
  it('ningún archivo de src/ contiene consultas SQL: todo pasa por stored procedures', async () => {
    const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
    const archivos = (await readdir(carpeta, { recursive: true })).filter((a) => a.endsWith('.ts'));
    const patrones = [
      /\bSELECT\s+[\w*@]/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bEXEC(UTE)?\s+\w/,
      /\.query\s*\(/,
      /\.batch\s*\(/,
    ];

    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const contenido = await readFile(path.join(carpeta, archivo), 'utf8');
      for (const patron of patrones) {
        if (patron.test(contenido)) hallazgos.push(`${archivo}: ${patron}`);
      }
    }
    expect(hallazgos).toEqual([]);
  });
});

describe('RF-01 Autenticación', () => {
  it('registra un cliente, guarda la sesión y nunca devuelve el hash', async () => {
    const correo = `registro.${Date.now()}@pruebas.test`;
    const respuesta = await api()
      .post('/api/auth/registro')
      .send({ correo, contrasena: 'Segura123!', nombres: 'Ana', apellidos: 'Pruebas' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.usuario.rol).toBe('CLIENTE');
    expect(respuesta.body.datos.accessToken).toBeTypeOf('string');
    expect(JSON.stringify(respuesta.body)).not.toMatch(/argon2|hash/i);
    expect(respuesta.headers['set-cookie']?.[0]).toMatch(/shopcart_rt=.+HttpOnly/i);
  });

  it('no permite registrar dos veces el mismo correo', async () => {
    const respuesta = await api()
      .post('/api/auth/registro')
      .send({ correo: CREDENCIALES.cliente.correo, contrasena: 'Segura123!', nombres: 'X', apellidos: 'Y' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CORREO_YA_REGISTRADO');
  });

  it('rechaza datos inválidos con el detalle de cada campo', async () => {
    const respuesta = await api()
      .post('/api/auth/registro')
      .send({ correo: 'no-es-correo', contrasena: '123', nombres: '', rol: 'ADMIN' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    const campos = respuesta.body.error.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['correo', 'contrasena', 'nombres']));
  });

  it('con contraseña incorrecta responde 401 sin decir si el correo existe', async () => {
    const existe = await api().post('/api/auth/login').send({ correo: CREDENCIALES.cliente.correo, contrasena: 'Mala123!' });
    const noExiste = await api().post('/api/auth/login').send({ correo: 'nadie@pruebas.test', contrasena: 'Mala123!' });
    expect(existe.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(existe.body.error.mensaje).toBe(noExiste.body.error.mensaje);
  });

  it('un token expirado devuelve 401 TOKEN_EXPIRADO', async () => {
    const vencido = jwt.sign({ rol: 'ADMIN', correo: 'admin@shopcart.test' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: '1',
      issuer: 'shopcart-api',
      audience: 'shopcart',
      expiresIn: -10,
    });
    const respuesta = await api().get('/api/auth/perfil').set('Authorization', `Bearer ${vencido}`);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_EXPIRADO');
  });

  it('rechaza tokens sin firma (alg none) o firmados con otro secreto', async () => {
    const sinFirma = jwt.sign({ rol: 'ADMIN' }, '', { algorithm: 'none', subject: '1' });
    const otroSecreto = jwt.sign({ rol: 'ADMIN' }, 'otro-secreto-cualquiera-de-32-caracteres', {
      subject: '1',
      issuer: 'shopcart-api',
      audience: 'shopcart',
    });
    for (const token of [sinFirma, otroSecreto]) {
      const respuesta = await api().get('/api/usuarios').set('Authorization', `Bearer ${token}`);
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
    }
  });

  it('sin token responde 401 y con un rol sin permiso responde 403', async () => {
    const cliente = await nuevoCliente();
    const sinToken = await api().get('/api/usuarios');
    const conCliente = await api().get('/api/usuarios').set('Authorization', `Bearer ${cliente.token}`);
    const operador = await iniciarSesion(CREDENCIALES.operador.correo, CREDENCIALES.operador.contrasena);
    const conOperador = await api().get('/api/reportes/resumen').set('Authorization', `Bearer ${operador}`);

    expect(sinToken.status).toBe(401);
    expect(conCliente.status).toBe(403);
    expect(conOperador.status).toBe(403);
  });

  it('rota el refresh token y, si se reutiliza uno viejo, cierra toda la sesión', async () => {
    const login = await api().post('/api/auth/login').send(CREDENCIALES.cliente).expect(200);
    const tokenViejo = /shopcart_rt=([^;]+)/.exec(String(login.headers['set-cookie']?.[0]))?.[1];
    const primeraRotacion = await api().post('/api/auth/refresh').set('Cookie', `shopcart_rt=${tokenViejo}`);
    expect(primeraRotacion.status).toBe(200);
    const tokenNuevo = /shopcart_rt=([^;]+)/.exec(String(primeraRotacion.headers['set-cookie']?.[0]))?.[1];
    expect(tokenNuevo).not.toBe(tokenViejo);

    // Esperar más que el margen de gracia y reutilizar el token ya rotado
    await new Promise((r) => setTimeout(r, 11_000));
    const reuso = await api().post('/api/auth/refresh').set('Cookie', `shopcart_rt=${tokenViejo}`);
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.codigo).toBe('REFRESH_REUTILIZADO');

    // Por seguridad, el token nuevo de esa misma familia también quedó revocado
    const conNuevo = await api().post('/api/auth/refresh').set('Cookie', `shopcart_rt=${tokenNuevo}`);
    expect(conNuevo.status).toBe(401);
  }, 30_000);

  it('al desactivar a un usuario pierde el acceso al instante aunque su token siga vigente', async () => {
    const cliente = await nuevoCliente('desactivado');
    const admin = await tokenAdmin();
    await api().get('/api/auth/perfil').set('Authorization', `Bearer ${cliente.token}`).expect(200);

    await api()
      .patch(`/api/usuarios/${cliente.idUsuario}/estado`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ activo: false })
      .expect(200);

    const despues = await api().get('/api/auth/perfil').set('Authorization', `Bearer ${cliente.token}`);
    expect(despues.status).toBe(401);
    expect(despues.body.error.codigo).toBe('SESION_REVOCADA');

    const login = await api().post('/api/auth/login').send({ correo: cliente.correo, contrasena: 'Prueba123!' });
    expect(login.status).toBe(403);
    expect(login.body.error.codigo).toBe('CUENTA_DESACTIVADA');
  });

  it('limita los intentos de login por IP (429)', async () => {
    const appLimitada = crearApp({ limiteLogin: 3 });
    const intentos = [];
    for (let i = 0; i < 5; i++) {
      intentos.push((await request(appLimitada).post('/api/auth/login').send({ correo: 'x@pruebas.test', contrasena: 'Mala123!' })).status);
    }
    expect(intentos).toEqual([401, 401, 401, 429, 429]);
  });

  it('responde con cabeceras de seguridad y sin X-Powered-By', async () => {
    const respuesta = await api().get('/api/salud');
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['content-security-policy']).toBeDefined();
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });
});
