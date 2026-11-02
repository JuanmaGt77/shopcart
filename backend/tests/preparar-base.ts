import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Antes de correr las pruebas se crea la base ShopCart_Test desde cero con los mismos
 * scripts que usa la instalación normal (incluidas las semillas y su verificación).
 */
export default function prepararBase(): void {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/db-setup.ts', '--reset', '--silencioso'], {
    cwd: raiz,
    env: { ...process.env, DB_NAME: 'ShopCart_Test' },
    stdio: 'inherit',
  });
}
