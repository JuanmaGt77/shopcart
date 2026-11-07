import { createBrowserRouter } from 'react-router';
import { LayoutPanel } from '@/app/layouts/layout-panel';
import { LayoutTienda } from '@/app/layouts/layout-tienda';
import { PaginaEstadoEntorno } from '@/app/pagina-estado-entorno';
import { PaginaNoEncontrada } from '@/app/pagina-no-encontrada';
import { RequiereRol } from '@/modulos/auth/componentes/requiere-rol';
import { PaginaLogin } from '@/modulos/auth/paginas/pagina-login';
import { PaginaRegistro } from '@/modulos/auth/paginas/pagina-registro';

const PERSONAL = ['OPERADOR', 'ADMIN'] as const;

/**
 * Rutas de la aplicación.
 * - Tienda: pública (visitantes y clientes).
 * - Panel: solo personal; cada área revisa además su rol.
 * Las áreas grandes se cargan bajo demanda (lazy): un cliente nunca descarga el código del panel.
 */
export const router = createBrowserRouter([
  {
    element: <LayoutTienda />,
    children: [{ index: true, element: <PaginaEstadoEntorno /> }],
  },
  { path: 'login', element: <PaginaLogin /> },
  { path: 'registro', element: <PaginaRegistro /> },
  {
    path: 'panel',
    element: <RequiereRol roles={PERSONAL} />,
    children: [
      {
        element: <LayoutPanel />,
        children: [{ index: true, handle: { titulo: 'Panel' }, element: <PaginaEstadoEntorno /> }],
      },
    ],
  },
  { path: '*', element: <PaginaNoEncontrada /> },
]);
