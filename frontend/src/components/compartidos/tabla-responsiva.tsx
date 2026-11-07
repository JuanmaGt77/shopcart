import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Números y montos alineados a la derecha. */
  derecha?: boolean;
  /** No se muestra en la tarjeta del celular (datos secundarios). */
  soloEscritorio?: boolean;
  className?: string;
}

interface TablaResponsivaProps<T> {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  /** Clic en la fila (por ejemplo, abrir el detalle). */
  alAbrir?: (fila: T) => void;
  /** Acciones de la fila (botones); van al final en la tabla y abajo en la tarjeta. */
  acciones?: (fila: T) => ReactNode;
  cargando?: boolean;
  vacio?: ReactNode;
  etiqueta: string;
}

/**
 * Listado del panel: tabla en pantallas medianas en adelante y tarjetas en el celular
 * (la primera columna es el título de la tarjeta y el resto se lista como "dato: valor").
 */
export function TablaResponsiva<T>({
  columnas,
  filas,
  claveFila,
  alAbrir,
  acciones,
  cargando = false,
  vacio,
  etiqueta,
}: TablaResponsivaProps<T>) {
  if (!filas) {
    return (
      <div className="space-y-2" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (filas.length === 0) return <>{vacio}</>;

  const [principal, ...resto] = columnas;
  const enTarjeta = resto.filter((c) => !c.soloEscritorio);

  return (
    <div className={cn('transition-opacity', cargando && 'opacity-60')} aria-busy={cargando}>
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table aria-label={etiqueta}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columnas.map((c) => (
                <TableHead key={c.clave} className={cn(c.derecha && 'text-right', c.className)}>
                  {c.titulo}
                </TableHead>
              ))}
              {acciones && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow
                key={claveFila(fila)}
                onClick={alAbrir ? () => alAbrir(fila) : undefined}
                className={cn(alAbrir && 'cursor-pointer')}
              >
                {columnas.map((c) => (
                  <TableCell
                    key={c.clave}
                    className={cn(c.derecha && 'text-right tabular-nums', c.className)}
                  >
                    {c.celda(fila)}
                  </TableCell>
                ))}
                {acciones && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">{acciones(fila)}</div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden" aria-label={etiqueta}>
        {filas.map((fila) => {
          const contenido = (
            <>
              {principal && <div className="font-medium">{principal.celda(fila)}</div>}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {enTarjeta.map((c) => (
                  <div key={c.clave} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{c.titulo}</dt>
                    <dd className="truncate">{c.celda(fila)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={claveFila(fila)} className="rounded-xl border bg-card">
              {alAbrir ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer space-y-2 rounded-xl p-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => alAbrir(fila)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && alAbrir(fila)}
                >
                  {contenido}
                </div>
              ) : (
                <div className="space-y-2 p-4">{contenido}</div>
              )}
              {acciones && <div className="flex flex-wrap gap-1 border-t px-3 py-2">{acciones(fila)}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
