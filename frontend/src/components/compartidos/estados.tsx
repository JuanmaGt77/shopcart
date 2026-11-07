import { CircleAlert, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorApi } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDeError } from '@/lib/errores';

/** Carga de una página completa (por ejemplo, mientras se recupera la sesión). */
export function PantallaCarga({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-[50svh] items-center justify-center gap-2 text-muted-foreground" role="status">
      <Spinner /> {texto}
    </div>
  );
}

/** Error de una consulta, con el mensaje de la API, su id de solicitud y un botón para reintentar. */
export function EstadoError({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const idSolicitud = error instanceof ErrorApi ? error.idSolicitud : undefined;
  return (
    <Empty className="border border-dashed border-destructive/30">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>No pudimos cargar esta información</EmptyTitle>
        <EmptyDescription>{mensajeDeError(error)}</EmptyDescription>
        {idSolicitud && <p className="font-mono text-xs text-muted-foreground">Referencia: {idSolicitud}</p>}
      </EmptyHeader>
      {alReintentar && (
        <EmptyContent>
          <Button variant="outline" onClick={alReintentar}>
            <RotateCw /> Reintentar
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

/** Lista o página sin datos, con una acción sugerida. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icono />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        {descripcion && <EmptyDescription>{descripcion}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
