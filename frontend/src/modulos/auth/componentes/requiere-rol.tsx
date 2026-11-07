import { ShieldX } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { EstadoVacio, PantallaCarga } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import type { Rol } from '../tipos';
import { useSesion } from '../use-sesion';

/**
 * Protege un área por rol. Sin sesión manda al login (y regresa después); con un rol sin permiso
 * muestra "No tienes permiso". La API vuelve a revisar el rol en cada petición: esto solo evita
 * mostrar pantallas que de todos modos responderían 403.
 */
export function RequiereRol({ roles }: { roles: readonly Rol[] }) {
  const sesion = useSesion();
  const ubicacion = useLocation();

  if (sesion.estado === 'cargando') return <PantallaCarga texto="Recuperando tu sesión…" />;

  if (!sesion.usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }

  if (!roles.includes(sesion.usuario.rol)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EstadoVacio
          icono={ShieldX}
          titulo="No tienes permiso para ver esta página"
          descripcion="Tu cuenta no tiene acceso a esta sección. Si crees que es un error, pide ayuda a un administrador."
        >
          <Button asChild>
            <Link to="/">Ir a la tienda</Link>
          </Button>
        </EstadoVacio>
      </div>
    );
  }

  return <Outlet />;
}
