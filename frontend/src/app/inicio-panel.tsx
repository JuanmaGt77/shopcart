import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';
import { PantallaCarga } from '@/components/compartidos/estados';
import { useSesion } from '@/modulos/auth/use-sesion';

const PaginaDashboard = lazy(() =>
  import('@/modulos/reportes/pagina-dashboard').then((m) => ({ default: m.PaginaDashboard })),
);

/** /panel: el administrador ve el dashboard; el operador (que no tiene acceso a reportes) va a pedidos. */
export function InicioPanel() {
  const { usuario } = useSesion();
  if (usuario?.rol !== 'ADMIN') return <Navigate to="pedidos" replace />;
  return (
    <Suspense fallback={<PantallaCarga />}>
      <PaginaDashboard />
    </Suspense>
  );
}
