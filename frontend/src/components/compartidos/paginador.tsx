import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paginasVisibles } from '@/lib/paginacion';
import { cn } from '@/lib/utils';

interface PaginadorProps {
  pagina: number;
  totalPaginas: number;
  totalRegistros?: number;
  alCambiar: (pagina: number) => void;
  className?: string;
}

/** Paginación del servidor (la API devuelve pagina, totalPaginas y totalRegistros). */
export function Paginador({ pagina, totalPaginas, totalRegistros, alCambiar, className }: PaginadorProps) {
  if (totalPaginas <= 1) return null;
  return (
    <nav
      aria-label="Paginación"
      className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
    >
      <p className="text-sm text-muted-foreground">
        Página {pagina} de {totalPaginas}
        {totalRegistros !== undefined && ` · ${totalRegistros.toLocaleString('es-GT')} resultados`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="lg"
          disabled={pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft /> <span className="hidden sm:inline">Anterior</span>
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {paginasVisibles(pagina, totalPaginas).map((p, i) =>
            p === '…' ? (
              <span key={`hueco-${i}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === pagina ? 'default' : 'ghost'}
                size="icon-lg"
                onClick={() => alCambiar(p)}
                aria-current={p === pagina ? 'page' : undefined}
                aria-label={`Página ${p}`}
              >
                {p}
              </Button>
            ),
          )}
        </div>
        <Button
          variant="outline"
          size="lg"
          disabled={pagina >= totalPaginas}
          onClick={() => alCambiar(pagina + 1)}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span> <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
