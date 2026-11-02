import { z } from 'zod';

// Node 24 lee el .env sin dependencias extra. Si no existe, se usan las variables del entorno
// (así funciona igual en Docker o en un servidor). Las variables ya definidas no se sobrescriben.
try {
  process.loadEnvFile();
} catch {
  // sin archivo .env
}

const booleano = z.stringbool({ truthy: ['true', '1', 'si', 'yes'], falsy: ['false', '0', 'no'] });

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/, 'Nombre de base inválido').default('ShopCart'),
  DB_USER: z.string().min(1, 'Falta DB_USER'),
  DB_PASSWORD: z.string().min(1, 'Falta DB_PASSWORD'),
  DB_ENCRYPT: booleano.default(false),
  DB_TRUST_SERVER_CERTIFICATE: booleano.default(true),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRA: z.string().regex(/^\d+[smhd]$/, 'Usa un formato como 15m o 1h').default('15m'),
  REFRESH_DIAS: z.coerce.number().int().min(1).max(60).default(7),
  COOKIE_SECURE: booleano.default(false),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean),
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REGISTRO: z.coerce.number().int().positive().default(5),
  JOB_RESERVAS_SEGUNDOS: z.coerce.number().int().min(1).default(15),
});

const resultado = esquemaEntorno.safeParse(process.env);

if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuración inválida. Revisa tu archivo .env:\n${detalle}`);
  process.exit(1);
}

if (
  resultado.data.NODE_ENV === 'production' &&
  resultado.data.JWT_ACCESS_SECRET.startsWith('cambia-este-secreto')
) {
  console.error('En producción hay que definir un JWT_ACCESS_SECRET propio.');
  process.exit(1);
}

export const env = resultado.data;
export type Entorno = typeof env;
