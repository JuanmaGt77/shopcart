import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import './compartido/esquemas.js';
import { logger } from './compartido/logger.js';
import type { Modulo } from './compartido/http/modulo.js';
import { manejadorErrores, rutaNoEncontrada } from './compartido/middlewares/manejador-errores.js';
import { generarOpenAPI } from './docs/openapi.js';
import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { rutasBitacora } from './modulos/bitacora/bitacora.rutas.js';
import { rutasCarrito } from './modulos/carrito/carrito.rutas.js';
import { rutasAtributos, rutasCategorias, rutasProductos, rutasVariantes } from './modulos/catalogo/catalogo.rutas.js';
import { rutasCheckout } from './modulos/checkout/checkout.rutas.js';
import { rutasCupones } from './modulos/cupones/cupones.rutas.js';
import { rutasDirecciones } from './modulos/direcciones/direcciones.rutas.js';
import { rutasInventario } from './modulos/inventario/inventario.rutas.js';
import { rutasPedidos } from './modulos/pedidos/pedidos.rutas.js';
import { rutasReportes } from './modulos/reportes/reportes.rutas.js';
import { rutasCatalogosGenerales, rutasParametros, rutasSalud } from './modulos/sistema/sistema.rutas.js';
import { rutasUsuarios } from './modulos/usuarios/usuarios.rutas.js';

export interface OpcionesApp {
  limiteLogin?: number;
  limiteRegistro?: number;
}

export function crearModulos(opciones: OpcionesApp = {}): Modulo[] {
  return [
    rutasSalud(),
    rutasAuth({
      limiteLogin: opciones.limiteLogin ?? env.RATE_LIMIT_LOGIN,
      limiteRegistro: opciones.limiteRegistro ?? env.RATE_LIMIT_REGISTRO,
    }),
    rutasUsuarios(),
    rutasCategorias(),
    rutasProductos(),
    rutasVariantes(),
    rutasAtributos(),
    rutasInventario(),
    rutasDirecciones(),
    rutasCarrito(),
    rutasCupones(),
    rutasCheckout(),
    rutasPedidos(),
    rutasReportes(),
    rutasBitacora(),
    rutasCatalogosGenerales(),
    rutasParametros(),
  ];
}

export function crearApp(opciones: OpcionesApp = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  // Cada solicitud lleva un id que aparece en el log y en las respuestas de error
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const recibido = req.headers['x-request-id'];
        const id = typeof recibido === 'string' && /^[\w-]{8,64}$/.test(recibido) ? recibido : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/salud' },
    }),
  );

  // Cabeceras de seguridad (X-Content-Type-Options, HSTS, CSP, X-Frame-Options...)
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Carrito-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const modulos = crearModulos(opciones);
  for (const modulo of modulos) app.use(modulo.base, modulo.router);

  const documento = generarOpenAPI(modulos);
  app.get('/api/openapi.json', (_req, res) => {
    res.json(documento);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(documento, { customSiteTitle: 'ShopCart API' }));

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
