import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useCategorias } from '../consultas';
import { iconoCategoria } from '../iconos';

export interface ValoresFiltro {
  idCategoria?: number | undefined;
  precioMin?: number | undefined;
  precioMax?: number | undefined;
  disponible?: boolean | undefined;
}

interface PanelFiltrosProps {
  valores: ValoresFiltro;
  alCambiar: (cambios: Partial<Record<keyof ValoresFiltro, number | boolean | undefined>>) => void;
  /** En el panel del celular se cierra al elegir. */
  alElegir?: () => void;
}

/** Filtros del catálogo: categoría, rango de precio y "solo con existencia". */
export function PanelFiltros({ valores, alCambiar, alElegir }: PanelFiltrosProps) {
  const { data: categorias } = useCategorias();
  const idSwitch = useId();

  return (
    <div className="space-y-6">
      <section aria-labelledby="filtro-categoria" className="space-y-2">
        <h3 id="filtro-categoria" className="text-sm font-semibold">
          Categoría
        </h3>
        <ul className="space-y-0.5">
          <li>
            <BotonCategoria
              activa={!valores.idCategoria}
              onClick={() => {
                alCambiar({ idCategoria: undefined });
                alElegir?.();
              }}
            >
              Todas
            </BotonCategoria>
          </li>
          {categorias?.map((categoria) => {
            const Icono = iconoCategoria(categoria.nombre);
            return (
              <li key={categoria.idCategoria}>
                <BotonCategoria
                  activa={valores.idCategoria === categoria.idCategoria}
                  onClick={() => {
                    alCambiar({ idCategoria: categoria.idCategoria });
                    alElegir?.();
                  }}
                >
                  <Icono className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="flex-1 truncate">{categoria.nombre}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {categoria.productosActivos}
                  </span>
                </BotonCategoria>
              </li>
            );
          })}
        </ul>
      </section>

      <RangoPrecio
        key={`${valores.precioMin ?? ''}-${valores.precioMax ?? ''}`}
        minimo={valores.precioMin}
        maximo={valores.precioMax}
        alAplicar={(precioMin, precioMax) => {
          alCambiar({ precioMin, precioMax });
          alElegir?.();
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={idSwitch} className="text-sm font-semibold">
          Solo con existencia
        </Label>
        <Switch
          id={idSwitch}
          checked={valores.disponible ?? false}
          onCheckedChange={(activo) => alCambiar({ disponible: activo || undefined })}
        />
      </div>
    </div>
  );
}

function BotonCategoria({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted',
        activa && 'bg-secondary font-medium text-secondary-foreground',
      )}
    >
      {children}
    </button>
  );
}

function RangoPrecio({
  minimo,
  maximo,
  alAplicar,
}: {
  minimo: number | undefined;
  maximo: number | undefined;
  alAplicar: (minimo: number | undefined, maximo: number | undefined) => void;
}) {
  const [desde, setDesde] = useState(minimo?.toString() ?? '');
  const [hasta, setHasta] = useState(maximo?.toString() ?? '');
  const aNumero = (texto: string) => (texto.trim() === '' ? undefined : Math.max(0, Number(texto)));
  const nDesde = aNumero(desde);
  const nHasta = aNumero(hasta);
  const invalido = nDesde !== undefined && nHasta !== undefined && nDesde > nHasta;

  const aplicar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!invalido) alAplicar(nDesde, nHasta);
  };

  return (
    <form onSubmit={aplicar} className="space-y-2" aria-labelledby="filtro-precio">
      <h3 id="filtro-precio" className="text-sm font-semibold">
        Precio (Q)
      </h3>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="Mín."
          aria-label="Precio mínimo"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="Máx."
          aria-label="Precio máximo"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          aria-invalid={invalido}
        />
      </div>
      {invalido && <p className="text-xs text-destructive">El mínimo no puede ser mayor que el máximo.</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={invalido}>
        Aplicar precio
      </Button>
    </form>
  );
}
