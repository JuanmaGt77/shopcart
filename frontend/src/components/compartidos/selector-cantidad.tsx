import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SelectorCantidadProps {
  valor: number;
  maximo: number;
  alCambiar: (valor: number) => void;
  deshabilitado?: boolean;
  tamano?: 'normal' | 'compacto';
  etiqueta?: string;
}

/** − cantidad + con tope en lo disponible. */
export function SelectorCantidad({
  valor,
  maximo,
  alCambiar,
  deshabilitado = false,
  tamano = 'normal',
  etiqueta = 'Cantidad',
}: SelectorCantidadProps) {
  const compacto = tamano === 'compacto';
  return (
    <div
      className={cn('inline-flex items-center rounded-lg border', compacto ? 'h-8' : 'h-11')}
      role="group"
      aria-label={etiqueta}
    >
      <Button
        type="button"
        variant="ghost"
        size={compacto ? 'icon' : 'icon-lg'}
        className={compacto ? '' : 'h-full w-11'}
        onClick={() => alCambiar(valor - 1)}
        disabled={deshabilitado || valor <= 1}
        aria-label="Quitar uno"
      >
        <Minus />
      </Button>
      <span
        className={cn('text-center font-medium tabular-nums', compacto ? 'w-8 text-sm' : 'w-10')}
        aria-live="polite"
      >
        {valor}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={compacto ? 'icon' : 'icon-lg'}
        className={compacto ? '' : 'h-full w-11'}
        onClick={() => alCambiar(valor + 1)}
        disabled={deshabilitado || valor >= maximo}
        aria-label="Agregar uno"
      >
        <Plus />
      </Button>
    </div>
  );
}
