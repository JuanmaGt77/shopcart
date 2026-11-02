import { defineConfig } from 'vitest/config';

/**
 * Las pruebas son de integración: levantan la app de Express real y hablan con un
 * SQL Server real, en una base aparte (ShopCart_Test) que se reconstruye desde cero
 * con los mismos scripts de database/scripts antes de cada corrida.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/preparar-base.ts'],
    include: ['tests/**/*.test.ts'],
    // Todas comparten la misma base: se corren archivo por archivo
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'ShopCart_Test',
      LOG_LEVEL: 'silent',
    },
  },
});
