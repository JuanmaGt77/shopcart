import { ArrowRight, Clock, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatearFechaHora } from '@/lib/formato';
import { plural } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { useSesion } from '@/modulos/auth/use-sesion';
import { useCarrito } from '../consultas';
import { useVaciarCarrito } from '../mutaciones';
import { FormularioCupon } from './formulario-cupon';
import { LineaCarrito } from './linea-carrito';
import { ResumenMontos } from './resumen-carrito';

interface ContenidoCarritoProps {
  /** "panel": lateral angosto; "pagina": dos columnas en escritorio. */
  modo: 'panel' | 'pagina';
  /** Para cerrar el panel lateral al navegar. */
  alNavegar?: () => void;
}

/** Líneas, cupón, totales y botón de pago. Lo comparten el panel lateral y la página /carrito. */
export function ContenidoCarrito({ modo, alNavegar }: ContenidoCarritoProps) {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const carrito = useCarrito();
  const vaciar = useVaciarCarrito();

  if (carrito.isPending) {
    return (
      <div className="space-y-4 p-1">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (carrito.isError)
    return <EstadoError error={carrito.error} alReintentar={() => void carrito.refetch()} />;

  const datos = carrito.data;
  if (datos.lineas.length === 0) {
    return (
      <EstadoVacio
        icono={ShoppingBag}
        titulo="Tu carrito está vacío"
        descripcion="Agrega aceites, accesorios o algo para el camino."
      >
        <Button asChild onClick={alNavegar}>
          <Link to="/productos">Ver productos</Link>
        </Button>
      </EstadoVacio>
    );
  }

  const irAPagar = () => {
    alNavegar?.();
    navegar(usuario ? '/checkout' : '/login?volver=/checkout');
  };

  const resumen = (
    <div className="space-y-4">
      <FormularioCupon carrito={datos} />
      <ResumenMontos
        filas={[
          { etiqueta: 'Subtotal', monto: datos.subtotal, nota: plural(datos.cantidadArticulos, 'artículo') },
          { etiqueta: 'Descuento', monto: datos.descuento, descuento: true },
        ]}
        total={datos.total}
      />
      <p className="text-xs text-muted-foreground">Precios con IVA incluido. El envío se elige al pagar.</p>
      {datos.tieneProblemas && (
        <p className="text-xs font-medium text-destructive">
          Revisa los productos marcados en rojo antes de pagar.
        </p>
      )}
      <Button size="xl" variant="promo" className="w-full" disabled={datos.tieneProblemas} onClick={irAPagar}>
        {usuario ? 'Continuar al pago' : 'Inicia sesión para pagar'} <ArrowRight />
      </Button>
    </div>
  );

  return (
    <div className={cn(modo === 'pagina' && 'grid gap-8 lg:grid-cols-[1fr_380px]')}>
      <div>
        {datos.checkoutActivo && (
          <Alert className="mb-2">
            <Clock />
            <AlertDescription>
              Tienes un pago en curso con unidades apartadas hasta las{' '}
              {formatearFechaHora(datos.checkoutActivo.expira)}. Si cambias el carrito, la reserva se libera.{' '}
              <Link to="/checkout" onClick={alNavegar} className="font-medium text-primary hover:underline">
                Continuar el pago
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <ul className="divide-y">
          {datos.lineas.map((linea) => (
            <LineaCarrito key={linea.idVariante} linea={linea} alNavegar={alNavegar} />
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={() => vaciar.mutate()}
          disabled={vaciar.isPending}
        >
          <Trash2 /> Vaciar carrito
        </Button>
      </div>
      {modo === 'pagina' ? (
        <aside
          className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-36"
          aria-label="Resumen del pedido"
        >
          <h2 className="mb-4 font-semibold">Resumen</h2>
          {resumen}
        </aside>
      ) : (
        <div className="mt-4 border-t pt-4">{resumen}</div>
      )}
    </div>
  );
}
