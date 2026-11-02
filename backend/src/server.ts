import { createServer } from 'node:http';
import { env } from './config/env.js';
import { crearApp } from './app.js';
import { logger } from './compartido/logger.js';
import { cerrarPool, obtenerPool } from './db/conexion.js';

const app = crearApp();
const servidor = createServer(app);

async function iniciar(): Promise<void> {
  try {
    await obtenerPool();
    logger.info('Conectado a SQL Server');
  } catch (error) {
    logger.error({ err: error }, 'No se pudo conectar a SQL Server; la API arranca y reintentará en la próxima solicitud');
  }

  servidor.listen(env.PORT, () => {
    logger.info(`API de ShopCart en http://localhost:${env.PORT}  ·  Swagger: http://localhost:${env.PORT}/api/docs`);
  });
}

async function apagar(senal: string): Promise<void> {
  logger.info(`${senal} recibido, cerrando...`);
  servidor.close();
  await cerrarPool().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));

void iniciar();
