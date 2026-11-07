import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatearQuetzales } from '@/lib/formato';
import { nivelExistencia } from '../existencia';
import type { ProductoResumen } from '../tipos';
import { ImagenProducto } from './imagen-producto';

/** Tarjeta del catálogo: imagen, marca, nombre, precio y aviso de existencia. */
export function TarjetaProducto({ producto }: { producto: ProductoResumen }) {
  const nivel = nivelExistencia(producto.disponible);
  const tieneRango = producto.precioMaximo > producto.precioMinimo;

  return (
    <Link
      to={`/productos/${producto.idProducto}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="relative overflow-hidden">
        <ImagenProducto
          url={producto.imagenUrl}
          alt={producto.nombre}
          categoria={producto.categoria}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {nivel === 'agotado' && (
          <Badge className="absolute top-2 left-2 bg-foreground/80 text-background">Agotado</Badge>
        )}
        {nivel === 'pocas' && (
          <Badge className="absolute top-2 left-2 bg-promo text-promo-foreground">
            ¡Últimas {producto.disponible}!
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs text-muted-foreground">{producto.marca ?? producto.categoria}</p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">
          {producto.nombre}
        </h3>
        <p className="mt-auto pt-1 text-base font-semibold tabular-nums">
          {tieneRango && <span className="text-xs font-normal text-muted-foreground">Desde </span>}
          {formatearQuetzales(producto.precioMinimo)}
        </p>
        {producto.cantidadVariantes > 1 && (
          <p className="text-xs text-muted-foreground">{producto.cantidadVariantes} opciones</p>
        )}
      </div>
    </Link>
  );
}

export function TarjetaProductoEsqueleto() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}
