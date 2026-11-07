import { Separator } from '@/components/ui/separator';
import { formatearQuetzales } from '@/lib/formato';
import { cn } from '@/lib/utils';

interface Fila {
  etiqueta: string;
  monto: number;
  /** Se muestra con signo menos y en verde. */
  descuento?: boolean;
  nota?: string;
}

/** Desglose de montos tal cual los calculó la API. */
export function ResumenMontos({
  filas,
  total,
  className,
}: {
  filas: Fila[];
  total: number;
  className?: string;
}) {
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">
            {fila.etiqueta}
            {fila.nota && <span className="ml-1 text-xs">({fila.nota})</span>}
          </dt>
          <dd className={cn('tabular-nums', fila.descuento && fila.monto > 0 && 'font-medium text-exito')}>
            {fila.descuento && fila.monto > 0
              ? `-${formatearQuetzales(fila.monto)}`
              : formatearQuetzales(fila.monto)}
          </dd>
        </div>
      ))}
      <Separator />
      <div className="flex items-center justify-between gap-4 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatearQuetzales(total)}</dd>
      </div>
    </dl>
  );
}
