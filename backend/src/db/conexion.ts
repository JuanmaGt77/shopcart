import sql from 'mssql';
import { env } from '../config/env.js';
import { logger } from '../compartido/logger.js';

const configuracion: sql.config = {
  server: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionTimeout: 15_000,
  requestTimeout: 30_000,
  pool: { max: env.DB_POOL_MAX, min: 0, idleTimeoutMillis: 30_000 },
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
    enableArithAbort: true,
    useUTC: true,
    appName: 'shopcart-api',
  },
};

let conexion: Promise<sql.ConnectionPool> | null = null;

/** Pool único para toda la API (se crea la primera vez que se necesita). */
export function obtenerPool(): Promise<sql.ConnectionPool> {
  if (!conexion) {
    const pool = new sql.ConnectionPool(configuracion);
    pool.on('error', (err: unknown) => logger.error({ err }, 'Error en el pool de SQL Server'));
    conexion = pool.connect().catch((err: unknown) => {
      conexion = null;
      throw err;
    });
  }
  return conexion;
}

export async function cerrarPool(): Promise<void> {
  if (!conexion) return;
  const pool = await conexion;
  conexion = null;
  await pool.close();
}
