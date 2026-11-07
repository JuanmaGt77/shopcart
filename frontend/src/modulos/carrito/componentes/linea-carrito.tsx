import { CircleAlert, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { SelectorCantidad } from '@/components/compartidos/selector-cantidad';
import { Button } from '@/components/ui/button';
import { formatearQuetzales } from '@/lib/formato';
import { ImagenProducto } from '@/modulos/catalogo/componentes/imagen-producto';
import type { LineaCarrito as Linea } from '../api';
import { useCambiarCantidad, useQuitarDelCarrito } from '../mutaciones';

/** Un producto del carrito: cantidad con tope en lo disponible, subtotal y avisos de existencia. */
export function LineaCarrito({ linea, alNavegar }: { linea: Linea; alNavegar?: () => void }) {
  const cambiar = useCambiarCantidad();
  const quitar = useQuitarDelCarrito();
  const ocupado = cambiar.isPending || quitar.isPending;

  return (
    <li className="flex gap-3 py-4" aria-busy={ocupado}>
      <Link
        to={`/productos/${linea.idProducto}?variante=${linea.idVariante}`}
        onClick={alNavegar}
        className="size-20 shrink-0 overflow-hidden rounded-lg border"
      >
        <ImagenProducto url={linea.imagenUrl} alt={linea.nombreProducto} />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/productos/${linea.idProducto}?variante=${linea.idVariante}`}
              onClick={alNavegar}
              className="line-clamp-2 text-sm font-medium hover:text-primary"
            >
              {linea.nombreProducto}
            </Link>
            {linea.descripcionVariante && (
              <p className="text-xs text-muted-foreground">{linea.descripcionVariante}</p>
            )}
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatearQuetzales(linea.subtotal)}</p>
        </div>

        {!linea.vendible ? (
          <Aviso texto="Ya no está a la venta. Quítalo para continuar." />
        ) : linea.excedeDisponible ? (
          <Aviso
            texto={
              linea.disponible > 0
                ? `Solo quedan ${linea.disponible}. Ajusta la cantidad para continuar.`
                : 'Se agotó. Quítalo para continuar.'
            }
          />
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <SelectorCantidad
            tamano="compacto"
            valor={linea.cantidad}
            maximo={Math.max(linea.disponible, 1)}
            deshabilitado={ocupado || !linea.vendible}
            alCambiar={(cantidad) => cambiar.mutate({ idVariante: linea.idVariante, cantidad })}
            etiqueta={`Cantidad de ${linea.nombreProducto}`}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {formatearQuetzales(linea.precioUnitario)} c/u
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => quitar.mutate(linea.idVariante)}
            disabled={ocupado}
            aria-label={`Quitar ${linea.nombreProducto}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-1 text-xs font-medium text-destructive">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}
