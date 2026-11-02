/**
 * Construye la base de ShopCart ejecutando database/scripts/*.sql en orden, sin
 * necesitar sqlcmd (solo Node y un SQL Server alcanzable).
 *
 *   npm run db:setup    crea la base solo si todavía no existe
 *   npm run db:reset    la elimina y la vuelve a crear desde cero
 *
 * Se conecta con DB_ADMIN_USER / DB_ADMIN_PASSWORD (un login que pueda crear bases)
 * y crea el login de la aplicación con DB_USER / DB_PASSWORD.
 *
 * Este script no tiene SQL propio: lee los archivos .sql del proyecto, reemplaza las
 * variables $(DBName), $(AppUser) y $(AppPassword) igual que sqlcmd, y envía cada
 * lote (separado por GO) por una única conexión, para que USE y SET se mantengan.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

try {
  process.loadEnvFile();
} catch {
  // sin .env: se usan las variables del entorno
}

const NOMBRE_SEGURO = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function variable(nombre: string, porDefecto?: string): string {
  const valor = process.env[nombre] ?? porDefecto;
  if (!valor) {
    console.error(`Falta la variable ${nombre} (revisa tu .env)`);
    process.exit(1);
  }
  return valor;
}

const config = {
  servidor: variable('DB_HOST', 'localhost'),
  puerto: Number(variable('DB_PORT', '1433')),
  base: variable('DB_NAME', 'ShopCart'),
  usuarioAdmin: variable('DB_ADMIN_USER', 'sa'),
  claveAdmin: variable('DB_ADMIN_PASSWORD'),
  usuarioApp: variable('DB_USER', 'shopcart_app'),
  claveApp: variable('DB_PASSWORD'),
  cifrar: (process.env['DB_ENCRYPT'] ?? 'false') === 'true',
};

if (!NOMBRE_SEGURO.test(config.base) || !NOMBRE_SEGURO.test(config.usuarioApp)) {
  console.error('DB_NAME y DB_USER solo pueden tener letras, números y guion bajo.');
  process.exit(1);
}
if (config.claveApp.includes("'")) {
  console.error('DB_PASSWORD no puede contener comillas simples.');
  process.exit(1);
}

const reiniciar = process.argv.includes('--reset');
const silencioso = process.argv.includes('--silencioso');
const carpetaScripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database/scripts');

function conexion(base: string): sql.config {
  return {
    server: config.servidor,
    port: config.puerto,
    user: config.usuarioAdmin,
    password: config.claveAdmin,
    database: base,
    requestTimeout: 120_000,
    pool: { max: 1, min: 1 },
    options: { encrypt: config.cifrar, trustServerCertificate: true, enableArithAbort: true },
  };
}

/** Las credenciales se validan contra master; si con master entra pero con la base no, la base no existe. */
async function existeBase(): Promise<boolean> {
  const master = new sql.ConnectionPool(conexion('master'));
  await master.connect();
  await master.close();

  const destino = new sql.ConnectionPool(conexion(config.base));
  try {
    await destino.connect();
    await destino.close();
    return true;
  } catch {
    return false;
  }
}

function sustituirVariables(texto: string): string {
  return texto
    .replaceAll('$(DBName)', config.base)
    .replaceAll('$(AppUser)', config.usuarioApp)
    .replaceAll('$(AppPassword)', config.claveApp);
}

async function principal(): Promise<void> {
  const log = (mensaje: string) => {
    if (!silencioso) console.log(mensaje);
  };

  if (!reiniciar && (await existeBase())) {
    log(`La base ${config.base} ya existe; no toco nada. Usa "npm run db:reset" para recrearla.`);
    return;
  }

  const archivos = (await readdir(carpetaScripts)).filter((a) => a.endsWith('.sql')).sort();
  const pool = new sql.ConnectionPool(conexion('master'));
  await pool.connect();

  try {
    log(`Creando ${config.base} en ${config.servidor}:${config.puerto} (${archivos.length} scripts)`);
    for (const archivo of archivos) {
      const texto = sustituirVariables(await readFile(path.join(carpetaScripts, archivo), 'utf8'));
      const lotes = texto
        .split(/^\s*GO\s*$/gim)
        .map((lote) => lote.trim())
        .filter((lote) => lote.length > 0);

      for (const lote of lotes) {
        const resultado = await pool.request().batch(lote);
        if (archivo.startsWith('059') && resultado.recordset?.length) {
          log(`  ${JSON.stringify(resultado.recordset[0])}`);
        }
      }
      log(`  -> ${archivo}`);
    }
    log(`Listo: base ${config.base} creada con sus objetos y datos semilla.`);
  } finally {
    await pool.close();
  }
}

principal().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`No se pudo preparar la base: ${mensaje}`);
  process.exit(1);
});
