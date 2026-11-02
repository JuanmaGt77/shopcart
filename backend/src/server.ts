import { createServer } from 'node:http';
import { env } from './config/env.js';
import { crearApp } from './app.js';
import { logger } from './compartido/logger.js';
import { cerrarPool, obtenerPool } from './db/conexion.js';
import { iniciarJobReservas } from './jobs/liberar-reservas.js';
import { iniciarTiempoReal } from './realtime/servidor.js';

const app = crearApp();
const servidor = createServer(app);
const io = iniciarTiempoReal(servidor);
const jobReservas = iniciarJobReservas();

async function iniciar(): Promise<void> {
  try {
    await obtenerPool();
    logger.info('Conectado a SQL Server');
  } catch (error) {
    logger.error({ err: error }, 'No se pudo conectar a SQL Server; se reintentará en la próxima solicitud');
  }

  servidor.listen(env.PORT, () => {
    logger.info(`API de ShopCart en http://localhost:${env.PORT}  ·  Swagger: http://localhost:${env.PORT}/api/docs`);
  });
}

async function apagar(senal: string): Promise<void> {
  logger.info(`${senal} recibido, cerrando ordenadamente...`);
  jobReservas.detener();
  await io.close();
  servidor.close();
  await cerrarPool().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));

void iniciar();
