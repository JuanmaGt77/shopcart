import { createBrowserRouter, Navigate } from 'react-router';
import { LayoutPanel } from '@/app/layouts/layout-panel';
import { LayoutTienda } from '@/app/layouts/layout-tienda';
import { PaginaEstadoEntorno } from '@/app/pagina-estado-entorno';
import { PaginaNoEncontrada } from '@/app/pagina-no-encontrada';
import { RequiereRol } from '@/modulos/auth/componentes/requiere-rol';
import { PaginaLogin } from '@/modulos/auth/paginas/pagina-login';
import { PaginaRegistro } from '@/modulos/auth/paginas/pagina-registro';
import { PaginaCarrito } from '@/modulos/carrito/paginas/pagina-carrito';
import { PaginaCatalogo } from '@/modulos/catalogo/paginas/pagina-catalogo';
import { PaginaInicio } from '@/modulos/catalogo/paginas/pagina-inicio';
import { PaginaProducto } from '@/modulos/catalogo/paginas/pagina-producto';
import { PaginaCheckout } from '@/modulos/checkout/paginas/pagina-checkout';
import { LayoutCuenta } from '@/modulos/cuenta/layout-cuenta';
import { PaginaDirecciones } from '@/modulos/cuenta/pagina-direcciones';
import { PaginaMiPedido } from '@/modulos/cuenta/pagina-mi-pedido';
import { PaginaMisPedidos } from '@/modulos/cuenta/pagina-mis-pedidos';
import { PaginaPerfil } from '@/modulos/cuenta/pagina-perfil';

const PERSONAL = ['OPERADOR', 'ADMIN'] as const;
const SOLO_CLIENTE = ['CLIENTE'] as const;

/**
 * Rutas de la aplicación.
 * - Tienda: pública (visitantes y clientes).
 * - Panel: solo personal; cada área revisa además su rol.
 * Las áreas grandes se cargan bajo demanda (lazy): un cliente nunca descarga el código del panel.
 */
export const router = createBrowserRouter([
  {
    element: <LayoutTienda />,
    children: [
      { index: true, element: <PaginaInicio /> },
      { path: 'productos', element: <PaginaCatalogo /> },
      { path: 'productos/:idProducto', element: <PaginaProducto /> },
      { path: 'carrito', element: <PaginaCarrito /> },
      {
        element: <RequiereRol roles={SOLO_CLIENTE} />,
        children: [
          { path: 'checkout', element: <PaginaCheckout /> },
          {
            path: 'cuenta',
            element: <LayoutCuenta />,
            children: [
              { index: true, element: <Navigate to="pedidos" replace /> },
              { path: 'pedidos', element: <PaginaMisPedidos /> },
              { path: 'pedidos/:idPedido', element: <PaginaMiPedido /> },
              { path: 'direcciones', element: <PaginaDirecciones /> },
              { path: 'perfil', element: <PaginaPerfil /> },
            ],
          },
        ],
      },
    ],
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
