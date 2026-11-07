import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useCarrito } from '../consultas';

/** Ícono del carrito con la cantidad de artículos. */
export function BotonCarrito() {
  const { data: carrito } = useCarrito();
  const cantidad = carrito?.cantidadArticulos ?? 0;

  return (
    <Button asChild variant="ghost" size="icon-lg" className="relative">
      <Link to="/carrito" aria-label={`Carrito, ${cantidad} artículo(s)`}>
        <ShoppingCart className="size-5" />
        {cantidad > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-promo px-1 text-[11px] font-semibold text-promo-foreground tabular-nums">
            {cantidad > 99 ? '99+' : cantidad}
          </span>
        )}
      </Link>
    </Button>
  );
}
