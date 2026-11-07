import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { conexion } from './socket';

/** Punto verde "En vivo" cuando el WebSocket está conectado. */
export function IndicadorConexion({ className }: { className?: string }) {
  const estado = useSyncExternalStore(conexion.suscribir, conexion.obtener);
  const enVivo = estado === 'conectado';
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      role="status"
      title={enVivo ? 'Los datos se actualizan solos' : 'Reconectando con el servidor…'}
    >
      <span className="relative flex size-2">
        {enVivo && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-exito opacity-60" />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            enVivo ? 'bg-exito' : 'bg-muted-foreground/50',
          )}
        />
      </span>
      {enVivo ? 'En vivo' : estado === 'conectando' ? 'Conectando…' : 'Sin conexión'}
    </span>
  );
}
