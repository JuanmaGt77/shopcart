import type { ReactNode } from 'react';

/** Descripción de la sección y acciones principales (el título va en el encabezado del panel). */
export function EncabezadoPanel({ descripcion, children }: { descripcion: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-muted-foreground">{descripcion}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Contenedor de filtros de un listado: se acomodan en varias filas en pantallas chicas. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3" role="search">
      {children}
    </div>
  );
}
