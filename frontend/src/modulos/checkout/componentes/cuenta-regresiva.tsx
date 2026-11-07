import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatearMinutos } from '../tiempo-reserva';

/** Aviso del tiempo que queda de la reserva; se pone rojo en el último minuto. */
export function CuentaRegresiva({ segundos }: { segundos: number }) {
  const urgente = segundos <= 60;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        urgente
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-primary/20 bg-primary/5',
      )}
      role="timer"
      aria-live={urgente ? 'assertive' : 'off'}
    >
      <Clock className="size-5 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-medium">Apartamos tus productos por 15 minutos</p>
        <p className={cn('text-xs', !urgente && 'text-muted-foreground')}>
          Los precios quedan congelados mientras pagas.
        </p>
      </div>
      <span
        className="font-mono text-2xl font-bold tabular-nums"
        aria-label={`Quedan ${formatearMinutos(segundos)}`}
      >
        {formatearMinutos(segundos)}
      </span>
    </div>
  );
}
