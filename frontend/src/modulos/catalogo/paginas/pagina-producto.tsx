import { CircleAlert, CircleCheck, PackageX, ShieldCheck, ShoppingCart, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { SelectorCantidad } from '@/components/compartidos/selector-cantidad';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { esErrorApi } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { usePuedeComprar } from '@/modulos/carrito/consultas';
import { useAgregarAlCarrito } from '@/modulos/carrito/mutaciones';
import { Galeria } from '../componentes/galeria';
import { SelectorVariantes } from '../componentes/selector-variantes';
import { TarjetaProducto } from '../componentes/tarjeta-producto';
import { useProducto, useProductos } from '../consultas';
import { nivelExistencia } from '../existencia';
import { buscarVariante, seleccionInicial, type Seleccion } from '../seleccion-variante';
import type { ProductoDetalle } from '../tipos';

export function PaginaProducto() {
  const idProducto = Number(useParams().idProducto);
  const producto = useProducto(idProducto);

  if (producto.isPending) return <DetalleEsqueleto />;
  if (producto.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        {esErrorApi(producto.error, 'PRODUCTO_NO_ENCONTRADO', 'NO_ENCONTRADO', 'VALIDACION') ? (
          <EstadoVacio
            icono={PackageX}
            titulo="Este producto no existe o ya no está a la venta"
            descripcion="Puede que lo hayamos retirado del catálogo."
          >
            <Button asChild>
              <Link to="/productos">Ver el catálogo</Link>
            </Button>
          </EstadoVacio>
        ) : (
          <EstadoError error={producto.error} alReintentar={() => void producto.refetch()} />
        )}
      </div>
    );
  }

  // key: al pasar a otro producto se reinicia la selección
  return <Detalle key={producto.data.idProducto} producto={producto.data} />;
}

function Detalle({ producto }: { producto: ProductoDetalle }) {
  const [parametros, setParametros] = useSearchParams();
  const [seleccion, setSeleccion] = useState<Seleccion>(() =>
    seleccionInicial(producto.variantes, Number(parametros.get('variante')) || undefined),
  );
  const [cantidad, setCantidad] = useState(1);
  const puedeComprar = usePuedeComprar();
  const agregar = useAgregarAlCarrito();

  const variante = buscarVariante(producto.variantes, seleccion);
  const disponible = variante?.disponible ?? 0;
  const nivel = nivelExistencia(disponible);
  const cantidadValida = Math.min(cantidad, Math.max(disponible, 1));

  const cambiarSeleccion = (nueva: Seleccion) => {
    setSeleccion(nueva);
    setCantidad(1);
    const elegida = buscarVariante(producto.variantes, nueva);
    if (elegida)
      setParametros({ variante: String(elegida.idVariante) }, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Inicio</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/productos?idCategoria=${producto.idCategoria}`}>{producto.categoria}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{producto.nombre}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <Galeria imagenes={producto.imagenes} nombre={producto.nombre} categoria={producto.categoria} />

        <div className="space-y-6">
          <header className="space-y-2">
            {producto.marca && (
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">{producto.marca}</p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{producto.nombre}</h1>
            <p className="text-3xl font-bold tabular-nums">
              {variante
                ? formatearQuetzales(variante.precio)
                : producto.precioMaximo > producto.precioMinimo
                  ? `${formatearQuetzales(producto.precioMinimo)} – ${formatearQuetzales(producto.precioMaximo)}`
                  : formatearQuetzales(producto.precioMinimo)}
            </p>
            <p className="text-xs text-muted-foreground">
              Precio con IVA incluido{variante && ` · SKU ${variante.sku}`}
            </p>
          </header>

          <SelectorVariantes
            variantes={producto.variantes}
            seleccion={seleccion}
            alCambiar={cambiarSeleccion}
          />

          {variante && (
            <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite" data-nivel={nivel}>
              {nivel === 'agotado' && (
                <>
                  <CircleAlert className="size-4 text-destructive" aria-hidden />
                  <span className="text-destructive">Agotado en esta opción</span>
                </>
              )}
              {nivel === 'pocas' && (
                <>
                  <CircleAlert className="size-4 text-promo" aria-hidden />
                  <span className="text-promo">¡Últimas {disponible} unidades!</span>
                </>
              )}
              {nivel === 'disponible' && (
                <>
                  <CircleCheck className="size-4 text-exito" aria-hidden />
                  <span>{disponible} disponibles</span>
                </>
              )}
            </p>
          )}

          {puedeComprar ? (
            <div className="flex flex-wrap items-center gap-3">
              <SelectorCantidad
                valor={cantidadValida}
                maximo={Math.min(disponible, 99)}
                alCambiar={setCantidad}
                deshabilitado={!variante || nivel === 'agotado'}
              />
              <Button
                size="xl"
                variant="promo"
                className="min-w-56 flex-1"
                disabled={!variante || nivel === 'agotado' || agregar.isPending}
                onClick={() =>
                  variante && agregar.mutate({ idVariante: variante.idVariante, cantidad: cantidadValida })
                }
              >
                {agregar.isPending ? <Spinner /> : <ShoppingCart />}
                {nivel === 'agotado' ? 'Agotado' : 'Agregar al carrito'}
              </Button>
            </div>
          ) : (
            <Alert>
              <Store />
              <AlertDescription>
                Estás viendo la tienda con una cuenta del personal. Para comprar, usa una cuenta de cliente.
              </AlertDescription>
            </Alert>
          )}

          <ul className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Envío a todo el país desde Q35
            </li>
            <li className="flex items-start gap-2">
              <Store className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Recoge gratis en la estación
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Pago seguro, sin cobros dobles
            </li>
          </ul>

          {producto.descripcion && (
            <section aria-labelledby="titulo-descripcion" className="space-y-2">
              <h2 id="titulo-descripcion" className="font-semibold">
                Descripción
              </h2>
              <p className="leading-relaxed text-muted-foreground">{producto.descripcion}</p>
            </section>
          )}
        </div>
      </div>

      <Relacionados idCategoria={producto.idCategoria} idProducto={producto.idProducto} />
    </div>
  );
}

function Relacionados({ idCategoria, idProducto }: { idCategoria: number; idProducto: number }) {
  const { data } = useProductos({ idCategoria, tamanoPagina: 5, disponible: true });
  const otros = data?.datos.filter((p) => p.idProducto !== idProducto).slice(0, 4) ?? [];
  if (otros.length === 0) return null;
  return (
    <section aria-labelledby="titulo-relacionados" className="mt-16 space-y-4">
      <h2 id="titulo-relacionados" className="text-xl font-bold">
        También te puede interesar
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {otros.map((p) => (
          <li key={p.idProducto} className="flex">
            <TarjetaProducto producto={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DetalleEsqueleto() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-2" aria-busy>
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
