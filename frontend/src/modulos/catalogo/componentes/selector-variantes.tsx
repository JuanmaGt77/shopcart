import { cn } from '@/lib/utils';
import { atributosDe, elegirValor, estadoValor, type Seleccion } from '../seleccion-variante';
import type { Variante } from '../tipos';

interface SelectorVariantesProps {
  variantes: Variante[];
  seleccion: Seleccion;
  alCambiar: (seleccion: Seleccion) => void;
}

/** Un grupo de opciones por atributo. Las agotadas se tachan y las combinaciones que no existen se deshabilitan. */
export function SelectorVariantes({ variantes, seleccion, alCambiar }: SelectorVariantesProps) {
  const atributos = atributosDe(variantes);
  if (atributos.length === 0) return null;

  return (
    <div className="space-y-4">
      {atributos.map((atributo) => (
        <fieldset key={atributo.nombre} className="space-y-2">
          <legend className="text-sm">
            <span className="font-semibold">{atributo.nombre}:</span>{' '}
            <span className="text-muted-foreground">{seleccion[atributo.nombre] ?? 'elige una opción'}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {atributo.valores.map((valor) => {
              const estado = estadoValor(variantes, seleccion, atributo.nombre, valor);
              const elegido = seleccion[atributo.nombre] === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={elegido}
                  disabled={estado === 'no-existe'}
                  title={
                    estado === 'agotado'
                      ? 'Agotado'
                      : estado === 'no-existe'
                        ? 'No disponible en esta combinación'
                        : undefined
                  }
                  onClick={() => alCambiar(elegirValor(variantes, seleccion, atributo.nombre, valor))}
                  className={cn(
                    'min-h-10 min-w-12 rounded-lg border px-3 text-sm transition-colors hover:border-primary/60',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    elegido && 'border-primary bg-primary/5 font-semibold text-primary ring-1 ring-primary',
                    estado === 'agotado' && 'text-muted-foreground line-through decoration-1',
                    estado === 'no-existe' && 'cursor-not-allowed opacity-40 hover:border-border',
                  )}
                >
                  {valor}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
