import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET no lleva el prefijo VITE_, así que nunca llega al código del navegador
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.API_PROXY_TARGET || 'http://localhost:3000';

  // El navegador siempre habla con el mismo origen (/api y /socket.io) y Vite reenvía a la API.
  // Así la cookie httpOnly del refresh token funciona sin CORS, igual que detrás de nginx en Docker.
  const proxy: Record<string, ProxyOptions> = {
    '/api': { target: api },
    '/socket.io': { target: api, ws: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    build: {
      rolldownOptions: {
        output: {
          // React cambia poco: en su propio archivo, el navegador lo conserva en caché entre versiones.
          // Recharts no se agrupa: queda dentro del dashboard, que solo descarga el administrador.
          codeSplitting: {
            groups: [{ name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ }],
          },
        },
      },
    },
  };
});
