import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { plural } from '@/lib/texto';
import { useCarrito } from '../consultas';
import { panelCarrito, usePanelCarritoAbierto } from '../panel-carrito';
import { ContenidoCarrito } from './contenido-carrito';

/** Ícono del carrito con la cantidad de artículos; abre el carrito en un panel lateral. */
export function BotonCarrito() {
  const { data: carrito } = useCarrito();
  const abierto = usePanelCarritoAbierto();
  const cantidad = carrito?.cantidadArticulos ?? 0;
  const cerrar = () => panelCarrito.cambiar(false);

  return (
    <Sheet open={abierto} onOpenChange={panelCarrito.cambiar}>
      <Button
        variant="ghost"
        size="icon-lg"
        className="relative"
        onClick={panelCarrito.abrir}
        aria-label={`Abrir carrito, ${plural(cantidad, 'artículo')}`}
      >
        <ShoppingCart className="size-5" />
        {cantidad > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-promo px-1 text-[11px] font-semibold text-promo-foreground tabular-nums">
            {cantidad > 99 ? '99+' : cantidad}
          </span>
        )}
      </Button>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Tu carrito</SheetTitle>
          <SheetDescription>
            {cantidad > 0 ? plural(cantidad, 'artículo') : 'Aún no agregas productos'}
            {cantidad > 0 && (
              <>
                {' · '}
                <Link to="/carrito" onClick={cerrar} className="text-primary hover:underline">
                  Ver carrito completo
                </Link>
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <ContenidoCarrito modo="panel" alNavegar={cerrar} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
