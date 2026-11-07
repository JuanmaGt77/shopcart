import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileClock,
  FolderTree,
  History,
  Package,
  Scale,
  Settings2,
  Store,
  TicketPercent,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, Outlet, useLocation, useMatches } from 'react-router';
import { Logo } from '@/components/compartidos/logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { SelectorTema } from '@/components/compartidos/selector-tema';
import { MenuUsuario } from '@/modulos/auth/componentes/menu-usuario';
import type { Rol } from '@/modulos/auth/tipos';
import { NOMBRE_ROL } from '@/modulos/auth/tipos';
import { useSesion } from '@/modulos/auth/use-sesion';
import { IndicadorConexion } from '@/tiempo-real/indicador-conexion';

interface Opcion {
  ruta: string;
  titulo: string;
  icono: LucideIcon;
  roles: readonly Rol[];
  exacta?: boolean;
}

const PERSONAL: readonly Rol[] = ['OPERADOR', 'ADMIN'];
const SOLO_ADMIN: readonly Rol[] = ['ADMIN'];

/** Mismo acceso por rol que la API: el operador no ve el dashboard ni la administración. */
const GRUPOS: { titulo: string; opciones: Opcion[] }[] = [
  {
    titulo: 'General',
    opciones: [{ ruta: '/panel', titulo: 'Dashboard', icono: BarChart3, roles: SOLO_ADMIN, exacta: true }],
  },
  {
    titulo: 'Operación',
    opciones: [
      { ruta: '/panel/pedidos', titulo: 'Pedidos', icono: ClipboardList, roles: PERSONAL },
      { ruta: '/panel/inventario', titulo: 'Inventario', icono: Boxes, roles: PERSONAL, exacta: true },
      { ruta: '/panel/inventario/kardex', titulo: 'Kardex', icono: History, roles: PERSONAL },
      { ruta: '/panel/inventario/conciliacion', titulo: 'Conciliación', icono: Scale, roles: PERSONAL },
    ],
  },
  {
    titulo: 'Administración',
    opciones: [
      { ruta: '/panel/productos', titulo: 'Productos', icono: Package, roles: SOLO_ADMIN },
      { ruta: '/panel/categorias', titulo: 'Categorías', icono: FolderTree, roles: SOLO_ADMIN },
      { ruta: '/panel/cupones', titulo: 'Cupones', icono: TicketPercent, roles: SOLO_ADMIN },
      { ruta: '/panel/usuarios', titulo: 'Usuarios', icono: Users, roles: SOLO_ADMIN },
      { ruta: '/panel/bitacora', titulo: 'Bitácora', icono: FileClock, roles: SOLO_ADMIN },
      { ruta: '/panel/parametros', titulo: 'Parámetros', icono: Settings2, roles: SOLO_ADMIN },
    ],
  },
];

/** Las rutas del panel declaran su título en `handle`; el encabezado muestra el de la ruta más interna. */
function useTituloPagina(): string {
  const coincidencias = useMatches();
  for (let i = coincidencias.length - 1; i >= 0; i--) {
    const handle = coincidencias[i]?.handle as { titulo?: string } | undefined;
    if (handle?.titulo) return handle.titulo;
  }
  return 'Panel';
}

export function LayoutPanel() {
  const titulo = useTituloPagina();
  return (
    <SidebarProvider>
      <MenuPanel />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" aria-label="Mostrar u ocultar el menú" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <h1 className="truncate text-base font-semibold">{titulo}</h1>
          <div className="ml-auto flex items-center gap-3">
            <IndicadorConexion className="hidden sm:inline-flex" />
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/">
                <Store /> Tienda
              </Link>
            </Button>
            <SelectorTema />
            <MenuUsuario enPanel />
          </div>
        </header>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MenuPanel() {
  const { usuario } = useSesion();
  const { isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const rol = usuario?.rol;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <Logo destino={rol === 'ADMIN' ? '/panel' : '/panel/pedidos'} conLema={false} />
      </SidebarHeader>
      <SidebarContent>
        {GRUPOS.map((grupo) => {
          const opciones = grupo.opciones.filter((o) => rol && o.roles.includes(rol));
          if (opciones.length === 0) return null;
          return (
            <SidebarGroup key={grupo.titulo}>
              <SidebarGroupLabel>{grupo.titulo}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {opciones.map((opcion) => {
                    const activa = opcion.exacta
                      ? pathname === opcion.ruta
                      : pathname === opcion.ruta || pathname.startsWith(`${opcion.ruta}/`);
                    return (
                      <SidebarMenuItem key={opcion.ruta}>
                        <SidebarMenuButton asChild isActive={activa} tooltip={opcion.titulo}>
                          <Link
                            to={opcion.ruta}
                            aria-current={activa ? 'page' : undefined}
                            onClick={() => isMobile && setOpenMobile(false)}
                          >
                            <opcion.icono />
                            <span>{opcion.titulo}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        {usuario && (
          <p className="truncate">
            {usuario.nombres} · <span className="font-medium text-primary">{NOMBRE_ROL[usuario.rol]}</span>
          </p>
        )}
        <IndicadorConexion className="sm:hidden" />
      </SidebarFooter>
    </Sidebar>
  );
}
