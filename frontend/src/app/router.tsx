import { createBrowserRouter, Navigate } from 'react-router';
import { LayoutPanel } from '@/app/layouts/layout-panel';
import { LayoutTienda } from '@/app/layouts/layout-tienda';
import { InicioPanel } from '@/app/inicio-panel';
import { PaginaNoEncontrada } from '@/app/pagina-no-encontrada';
import { RequiereRol } from '@/modulos/auth/componentes/requiere-rol';
import { PaginaCarrito } from '@/modulos/carrito/paginas/pagina-carrito';
import { PaginaCatalogo } from '@/modulos/catalogo/paginas/pagina-catalogo';
import { PaginaInicio } from '@/modulos/catalogo/paginas/pagina-inicio';
import { PaginaProducto } from '@/modulos/catalogo/paginas/pagina-producto';

const PERSONAL = ['OPERADOR', 'ADMIN'] as const;
const SOLO_CLIENTE = ['CLIENTE'] as const;
const SOLO_ADMIN = ['ADMIN'] as const;

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
          {
            path: 'checkout',
            lazy: () =>
              import('@/modulos/checkout/paginas/pagina-checkout').then((m) => ({
                Component: m.PaginaCheckout,
              })),
          },
          {
            path: 'cuenta',
            lazy: () => import('@/modulos/cuenta/layout-cuenta').then((m) => ({ Component: m.LayoutCuenta })),
            children: [
              { index: true, element: <Navigate to="pedidos" replace /> },
              {
                path: 'pedidos',
                lazy: () =>
                  import('@/modulos/cuenta/pagina-mis-pedidos').then((m) => ({
                    Component: m.PaginaMisPedidos,
                  })),
              },
              {
                path: 'pedidos/:idPedido',
                lazy: () =>
                  import('@/modulos/cuenta/pagina-mi-pedido').then((m) => ({ Component: m.PaginaMiPedido })),
              },
              {
                path: 'direcciones',
                lazy: () =>
                  import('@/modulos/cuenta/pagina-direcciones').then((m) => ({
                    Component: m.PaginaDirecciones,
                  })),
              },
              {
                path: 'perfil',
                lazy: () =>
                  import('@/modulos/cuenta/pagina-perfil').then((m) => ({ Component: m.PaginaPerfil })),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'login',
    lazy: () => import('@/modulos/auth/paginas/pagina-login').then((m) => ({ Component: m.PaginaLogin })),
  },
  {
    path: 'registro',
    lazy: () =>
      import('@/modulos/auth/paginas/pagina-registro').then((m) => ({ Component: m.PaginaRegistro })),
  },
  {
    path: 'panel',
    element: <RequiereRol roles={PERSONAL} />,
    children: [
      {
        element: <LayoutPanel />,
        children: [
          { index: true, handle: { titulo: 'Dashboard' }, element: <InicioPanel /> },
          {
            path: 'pedidos',
            handle: { titulo: 'Pedidos' },
            lazy: () =>
              import('@/modulos/pedidos/panel/pagina-pedidos-panel').then((m) => ({
                Component: m.PaginaPedidosPanel,
              })),
          },
          {
            path: 'pedidos/:idPedido',
            handle: { titulo: 'Detalle del pedido' },
            lazy: () =>
              import('@/modulos/pedidos/panel/pagina-pedido-panel').then((m) => ({
                Component: m.PaginaPedidoPanel,
              })),
          },
          {
            path: 'inventario',
            handle: { titulo: 'Inventario' },
            lazy: () =>
              import('@/modulos/inventario/pagina-existencias').then((m) => ({
                Component: m.PaginaExistencias,
              })),
          },
          {
            path: 'inventario/kardex',
            handle: { titulo: 'Kardex' },
            lazy: () =>
              import('@/modulos/inventario/pagina-kardex').then((m) => ({ Component: m.PaginaKardex })),
          },
          {
            path: 'inventario/conciliacion',
            handle: { titulo: 'Conciliación de inventario' },
            lazy: () =>
              import('@/modulos/inventario/pagina-conciliacion').then((m) => ({
                Component: m.PaginaConciliacion,
              })),
          },
          {
            // Administración: solo el rol ADMIN (la API también lo exige en cada endpoint)
            element: <RequiereRol roles={SOLO_ADMIN} />,
            children: [
              {
                path: 'productos',
                handle: { titulo: 'Productos' },
                lazy: () =>
                  import('@/modulos/catalogo/admin/pagina-productos-admin').then((m) => ({
                    Component: m.PaginaProductosAdmin,
                  })),
              },
              {
                path: 'productos/:idProducto',
                handle: { titulo: 'Producto' },
                lazy: () =>
                  import('@/modulos/catalogo/admin/pagina-producto-admin').then((m) => ({
                    Component: m.PaginaProductoAdmin,
                  })),
              },
              {
                path: 'categorias',
                handle: { titulo: 'Categorías' },
                lazy: () =>
                  import('@/modulos/catalogo/admin/pagina-categorias').then((m) => ({
                    Component: m.PaginaCategorias,
                  })),
              },
              {
                path: 'cupones',
                handle: { titulo: 'Cupones' },
                lazy: () =>
                  import('@/modulos/cupones/pagina-cupones').then((m) => ({ Component: m.PaginaCupones })),
              },
              {
                path: 'usuarios',
                handle: { titulo: 'Usuarios' },
                lazy: () =>
                  import('@/modulos/usuarios/pagina-usuarios').then((m) => ({ Component: m.PaginaUsuarios })),
              },
              {
                path: 'bitacora',
                handle: { titulo: 'Bitácora' },
                lazy: () =>
                  import('@/modulos/bitacora/pagina-bitacora').then((m) => ({ Component: m.PaginaBitacora })),
              },
              {
                path: 'parametros',
                handle: { titulo: 'Parámetros del sistema' },
                lazy: () =>
                  import('@/modulos/sistema/pagina-parametros').then((m) => ({
                    Component: m.PaginaParametros,
                  })),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <PaginaNoEncontrada /> },
]);
