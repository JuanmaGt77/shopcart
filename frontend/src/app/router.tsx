import { createBrowserRouter } from 'react-router';
import { PaginaEstadoEntorno } from '@/app/pagina-estado-entorno';
import { PaginaNoEncontrada } from '@/app/pagina-no-encontrada';

/**
 * Rutas de la aplicación. Por ahora solo la página que comprueba el entorno;
 * la tienda, la cuenta del cliente y los paneles del personal se agregan por módulo.
 */
export const router = createBrowserRouter([
  { path: '/', element: <PaginaEstadoEntorno /> },
  { path: '*', element: <PaginaNoEncontrada /> },
]);
