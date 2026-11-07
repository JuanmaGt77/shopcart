import {
  Check,
  CircleX,
  PackageCheck,
  PackageOpen,
  Truck,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatearFechaHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { CodigoEstadoPedido } from '../estados';
import type { CambioEstadoPedido } from '../tipos';

const ICONOS: Record<CodigoEstadoPedido, LucideIcon> = {
  PAGADO: Wallet,
  EN_PREPARACION: PackageOpen,
  DESPACHADO: Truck,
  ENTREGADO: PackageCheck,
  DEVUELTO_PARCIAL: Undo2,
  DEVUELTO: Undo2,
  CANCELADO: CircleX,
};

/** Recorrido normal de un pedido; los que aún no pasan se muestran en gris. */
const RECORRIDO: CodigoEstadoPedido[] = ['PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];

const NOMBRE_PASO: Record<string, string> = {
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
};

/**
 * Línea de tiempo con el historial real (quién y cuándo) y, si el pedido sigue su curso normal,
 * los pasos que faltan. Se actualiza sola con el evento pedido:estado.
 */
export function LineaTiempo({
  historial,
  estadoActual,
  mostrarUsuario = false,
}: {
  historial: CambioEstadoPedido[];
  estadoActual: CodigoEstadoPedido;
  mostrarUsuario?: boolean;
}) {
  const ordenado = [...historial].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const indiceActual = RECORRIDO.indexOf(estadoActual);
  const pendientes = indiceActual >= 0 ? RECORRIDO.slice(indiceActual + 1) : [];

  return (
    <ol className="relative space-y-5 border-l-2 border-muted pl-6">
      {ordenado.map((cambio, i) => {
        const Icono = ICONOS[cambio.estadoNuevoCodigo] ?? Check;
        const ultimo = i === ordenado.length - 1;
        return (
          <li key={cambio.idPedidoHistorialEstado} className="relative">
            <span
              className={cn(
                'absolute top-0 -left-[37px] flex size-7 items-center justify-center rounded-full border-2 border-background',
                cambio.estadoNuevoCodigo === 'CANCELADO'
                  ? 'bg-destructive text-white'
                  : ultimo
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/15 text-primary',
              )}
            >
              <Icono className="size-3.5" aria-hidden />
            </span>
            <p className={cn('text-sm font-medium', ultimo && 'text-primary')}>{cambio.estadoNuevo}</p>
            <p className="text-xs text-muted-foreground">
              {formatearFechaHora(cambio.fecha)}
              {mostrarUsuario && cambio.usuario && ` · ${cambio.usuario}`}
            </p>
            {cambio.comentario && (
              <p className="mt-0.5 text-sm text-muted-foreground">“{cambio.comentario}”</p>
            )}
          </li>
        );
      })}
      {pendientes.map((estado) => {
        const Icono = ICONOS[estado];
        return (
          <li key={estado} className="relative opacity-50">
            <span className="absolute top-0 -left-[37px] flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground">
              <Icono className="size-3.5" aria-hidden />
            </span>
            <p className="text-sm">{NOMBRE_PASO[estado]}</p>
            <p className="text-xs text-muted-foreground">Pendiente</p>
          </li>
        );
      })}
    </ol>
  );
}
