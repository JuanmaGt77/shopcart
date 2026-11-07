import { cn } from '@/lib/utils';
import { COLOR_ESTADO_PEDIDO, NOMBRE_ESTADO_PEDIDO, type CodigoEstadoPedido } from '../estados';

export function InsigniaEstado({ estado, className }: { estado: CodigoEstadoPedido; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        COLOR_ESTADO_PEDIDO[estado],
        className,
      )}
    >
      {NOMBRE_ESTADO_PEDIDO[estado]}
    </span>
  );
}
