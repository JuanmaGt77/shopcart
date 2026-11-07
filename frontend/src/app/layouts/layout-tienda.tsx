import { LayoutDashboard, Menu, Store, Truck } from 'lucide-react';
import { Link, NavLink, Outlet, useSearchParams } from 'react-router';
import { Logo } from '@/components/compartidos/logo';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MenuUsuario } from '@/modulos/auth/componentes/menu-usuario';
import { esPersonal } from '@/modulos/auth/tipos';
import { useSesion } from '@/modulos/auth/use-sesion';
import { BotonCarrito } from '@/modulos/carrito/componentes/boton-carrito';
import { Buscador } from '@/modulos/catalogo/componentes/buscador';
import { useCategorias } from '@/modulos/catalogo/consultas';
import { iconoCategoria } from '@/modulos/catalogo/iconos';

/** Estructura de la tienda: encabezado con búsqueda, categorías, carrito y cuenta; pie de página. */
export function LayoutTienda() {
  const { usuario } = useSesion();
  const personal = esPersonal(usuario?.rol);

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <div className="bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground sm:text-sm">
        <Truck className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
        Envío a todo el país o <strong>recoge gratis en la estación</strong>. Primera compra: usa{' '}
        <strong className="font-mono">BIENVENIDA10</strong>
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4">
          <MenuCategoriasMovil />
          <Logo className="shrink-0" />
          <Buscador className="mx-auto hidden w-full max-w-xl md:block" />
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {personal ? (
              <Button asChild variant="outline" size="lg" className="hidden sm:inline-flex">
                <Link to="/panel">
                  <LayoutDashboard /> Panel
                </Link>
              </Button>
            ) : (
              <BotonCarrito />
            )}
            <MenuUsuario />
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <Buscador />
        </div>
        <NavCategorias />
      </header>

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t bg-muted/40">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
          <div className="space-y-2">
            <Logo />
            <p className="text-muted-foreground">
              Lubricantes, accesorios y lo que encuentras en la tienda de tu estación, ahora en línea.
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold">Comprar</h2>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <Link to="/productos" className="hover:text-foreground">
                  Todos los productos
                </Link>
              </li>
              <li>
                <Link to="/cuenta/pedidos" className="hover:text-foreground">
                  Mis pedidos
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold">Aviso</h2>
            <p className="text-muted-foreground">
              Proyecto del Tech Challenge 360 (Grupo Pentandra). Productos, precios e imágenes de referencia;
              el pago es simulado.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Fila de categorías (escritorio). En celular se desliza horizontalmente. */
function NavCategorias() {
  const { data: categorias } = useCategorias();
  const [parametros] = useSearchParams();
  const seleccionada = parametros.get('idCategoria');

  return (
    <nav aria-label="Categorías" className="hidden border-t md:block">
      <ul className="mx-auto flex max-w-7xl [scrollbar-width:none] gap-1 overflow-x-auto px-4 py-1.5">
        <li>
          <NavLink
            to="/productos"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted',
                isActive && !seleccionada && 'bg-secondary font-medium text-secondary-foreground',
              )
            }
          >
            <Store className="size-4" aria-hidden /> Todo
          </NavLink>
        </li>
        {categorias?.map((categoria) => {
          const Icono = iconoCategoria(categoria.nombre);
          const activa = seleccionada === String(categoria.idCategoria);
          return (
            <li key={categoria.idCategoria}>
              <Link
                to={`/productos?idCategoria=${categoria.idCategoria}`}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted',
                  activa && 'bg-secondary font-medium text-secondary-foreground',
                )}
              >
                <Icono className="size-4" aria-hidden /> {categoria.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Menú lateral con las categorías para celular. */
function MenuCategoriasMovil() {
  const { data: categorias } = useCategorias();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Abrir categorías">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Categorías</SheetTitle>
        </SheetHeader>
        <nav aria-label="Categorías" className="px-2">
          <ul className="space-y-1">
            <li>
              <SheetClose asChild>
                <Link
                  to="/productos"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
                >
                  <Store className="size-5 text-primary" aria-hidden /> Todos los productos
                </Link>
              </SheetClose>
            </li>
            {categorias?.map((categoria) => {
              const Icono = iconoCategoria(categoria.nombre);
              return (
                <li key={categoria.idCategoria}>
                  <SheetClose asChild>
                    <Link
                      to={`/productos?idCategoria=${categoria.idCategoria}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
                    >
                      <Icono className="size-5 text-primary" aria-hidden /> {categoria.nombre}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
