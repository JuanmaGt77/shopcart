import { ArrowRight, Droplet, PackageCheck, ShieldCheck, Store, TicketPercent, Truck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TarjetaProducto, TarjetaProductoEsqueleto } from '../componentes/tarjeta-producto';
import { useCategorias, useProductos } from '../consultas';
import { iconoCategoria } from '../iconos';

const CUPONES = [
  { codigo: 'BIENVENIDA10', texto: '10 % en tu primera compra desde Q100' },
  { codigo: 'LUBRICANTES15', texto: '15 % en lubricantes (hasta Q150)' },
  { codigo: 'MOTO20', texto: '20 % en equipo para moto' },
];

const BENEFICIOS = [
  { icono: Truck, titulo: 'Envío a todo el país', texto: 'Estándar Q35 o express Q60 en la capital' },
  { icono: Store, titulo: 'Recoge en la estación', texto: 'Sin costo, listo en 1 a 2 días' },
  { icono: PackageCheck, titulo: 'Sigue tu pedido', texto: 'Te avisamos en vivo cada cambio' },
  { icono: ShieldCheck, titulo: 'Pago seguro', texto: 'Un clic, un cobro: nunca te cobramos doble' },
];

export function PaginaInicio() {
  const categorias = useCategorias();
  const novedades = useProductos({
    ordenarPor: 'recientes',
    direccion: 'desc',
    disponible: true,
    tamanoPagina: 8,
  });
  const lubricantes = categorias.data?.find((c) => c.nombre === 'Lubricantes');

  return (
    <div className="space-y-14 pb-6">
      <section className="relative overflow-hidden bg-marca text-marca-foreground">
        <div
          className="pointer-events-none absolute -top-32 right-0 size-[28rem] rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-promo/30 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
              <Droplet className="size-4" aria-hidden /> Lo de tu estación, ahora en línea
            </p>
            <h1 className="max-w-xl text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl">
              Todo para tu ruta, sin hacer fila.
            </h1>
            <p className="max-w-lg text-lg text-marca-foreground/85">
              Aceites, aditivos, accesorios y algo para el camino. Te lo enviamos o lo recoges en la estación.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="promo">
                <Link to={lubricantes ? `/productos?idCategoria=${lubricantes.idCategoria}` : '/productos'}>
                  Ver lubricantes <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link to="/productos">Todo el catálogo</Link>
              </Button>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3" aria-label="Beneficios">
            {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <Icono className="mb-2 size-6" aria-hidden />
                <p className="font-semibold">{titulo}</p>
                <p className="text-sm text-marca-foreground/80">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="titulo-categorias" className="mx-auto max-w-7xl space-y-5 px-4">
        <h2 id="titulo-categorias" className="text-2xl font-bold tracking-tight">
          Compra por categoría
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categorias.data
            ? categorias.data.map((categoria) => {
                const Icono = iconoCategoria(categoria.nombre);
                return (
                  <li key={categoria.idCategoria}>
                    <Link
                      to={`/productos?idCategoria=${categoria.idCategoria}`}
                      className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/50"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icono className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-tight font-medium">{categoria.nombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {categoria.productosActivos} productos
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })
            : Array.from({ length: 8 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[78px] rounded-xl" />
                </li>
              ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-cupones" className="mx-auto max-w-7xl px-4">
        <div className="grid gap-4 rounded-2xl border border-promo/20 bg-promo/5 p-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-promo text-promo-foreground">
              <TicketPercent className="size-6" aria-hidden />
            </span>
            <h2 id="titulo-cupones" className="text-xl font-bold">
              Cupones vigentes
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {CUPONES.map((cupon) => (
              <li
                key={cupon.codigo}
                className="rounded-xl border border-dashed border-promo/40 bg-background px-4 py-3"
              >
                <p className="font-mono font-bold text-promo">{cupon.codigo}</p>
                <p className="text-sm text-muted-foreground">{cupon.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="titulo-novedades" className="mx-auto max-w-7xl space-y-5 px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="titulo-novedades" className="text-2xl font-bold tracking-tight">
            Novedades
          </h2>
          <Button asChild variant="link">
            <Link to="/productos">
              Ver todo <ArrowRight />
            </Link>
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {novedades.data
            ? novedades.data.datos.map((producto) => (
                <li key={producto.idProducto} className="flex">
                  <TarjetaProducto producto={producto} />
                </li>
              ))
            : Array.from({ length: 8 }, (_, i) => (
                <li key={i}>
                  <TarjetaProductoEsqueleto />
                </li>
              ))}
        </ul>
      </section>
    </div>
  );
}
