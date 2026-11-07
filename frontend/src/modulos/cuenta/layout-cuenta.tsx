import { MapPin, Package, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const OPCIONES = [
  { ruta: '/cuenta/pedidos', titulo: 'Mis pedidos', icono: Package },
  { ruta: '/cuenta/direcciones', titulo: 'Mis direcciones', icono: MapPin },
  { ruta: '/cuenta/perfil', titulo: 'Mi perfil', icono: UserRound },
];

/** Área del cliente: menú lateral en escritorio y pestañas desplazables en el celular. */
export function LayoutCuenta() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[200px_1fr] lg:py-8">
      <nav aria-label="Mi cuenta">
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {OPCIONES.map(({ ruta, titulo, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-muted',
                    isActive && 'bg-secondary font-medium text-secondary-foreground',
                  )
                }
              >
                <Icono className="size-4" aria-hidden /> {titulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
