import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatearQuetzales } from '@/lib/formato';
import { plural } from '@/lib/texto';
import { PanelFiltros } from '../componentes/panel-filtros';
import { TarjetaProducto, TarjetaProductoEsqueleto } from '../componentes/tarjeta-producto';
import { useCategorias, useProductos } from '../consultas';
import type { FiltrosProductos } from '../tipos';

const ORDENES = {
  recientes: { etiqueta: 'Más recientes', ordenarPor: 'recientes', direccion: 'desc' },
  'precio-asc': { etiqueta: 'Precio: menor a mayor', ordenarPor: 'precio', direccion: 'asc' },
  'precio-desc': { etiqueta: 'Precio: mayor a menor', ordenarPor: 'precio', direccion: 'desc' },
  nombre: { etiqueta: 'Nombre (A-Z)', ordenarPor: 'nombre', direccion: 'asc' },
} as const;
type Orden = keyof typeof ORDENES;

const esquemaUrl = z.object({
  q: enUrl.texto(),
  idCategoria: enUrl.entero(),
  precioMin: enUrl.monto(),
  precioMax: enUrl.monto(),
  disponible: enUrl.bandera(),
  orden: enUrl.opcion(['recientes', 'precio-asc', 'precio-desc', 'nombre']),
  pagina: enUrl.pagina(),
});

const POR_PAGINA = 24;

export function PaginaCatalogo() {
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const { data: categorias } = useCategorias();
  const orden: Orden = filtros.orden ?? 'recientes';

  const consulta: FiltrosProductos = {
    q: filtros.q,
    idCategoria: filtros.idCategoria,
    precioMin: filtros.precioMin,
    precioMax: filtros.precioMax,
    disponible: filtros.disponible,
    ordenarPor: ORDENES[orden].ordenarPor,
    direccion: ORDENES[orden].direccion,
    pagina: filtros.pagina,
    tamanoPagina: POR_PAGINA,
  };
  const productos = useProductos(consulta);

  const categoria = categorias?.find((c) => c.idCategoria === filtros.idCategoria);
  const titulo = filtros.q ? `Resultados para “${filtros.q}”` : (categoria?.nombre ?? 'Todos los productos');

  const etiquetas = [
    filtros.q && { clave: 'q', texto: `“${filtros.q}”` },
    categoria && { clave: 'idCategoria', texto: categoria.nombre },
    (filtros.precioMin !== undefined || filtros.precioMax !== undefined) && {
      clave: 'precio',
      texto: `${filtros.precioMin !== undefined ? formatearQuetzales(filtros.precioMin) : 'Q0'} – ${
        filtros.precioMax !== undefined ? formatearQuetzales(filtros.precioMax) : 'sin límite'
      }`,
    },
    filtros.disponible && { clave: 'disponible', texto: 'Con existencia' },
  ].filter((e): e is { clave: string; texto: string } => Boolean(e));

  const quitar = (clave: string) =>
    clave === 'precio'
      ? cambiar({ precioMin: undefined, precioMax: undefined })
      : cambiar({ [clave]: undefined });

  const irAPagina = (pagina: number) => {
    cambiar({ pagina });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const panel = <PanelFiltros valores={filtros} alCambiar={cambiar} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros">
          <div className="sticky top-36">{panel}</div>
        </aside>

        <section aria-labelledby="titulo-catalogo" className="min-w-0 space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="titulo-catalogo" className="text-2xl font-bold tracking-tight">
                {titulo}
              </h1>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {productos.data ? plural(productos.data.paginacion.totalRegistros, 'producto') : 'Buscando…'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sheet open={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="lg" className="lg:hidden">
                    <SlidersHorizontal /> Filtros
                    {etiquetas.length > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {etiquetas.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-6">
                    <PanelFiltros
                      valores={filtros}
                      alCambiar={cambiar}
                      alElegir={() => setFiltrosAbiertos(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <Select
                value={orden}
                onValueChange={(valor) => cambiar({ orden: valor === 'recientes' ? undefined : valor })}
              >
                <SelectTrigger className="h-9 w-48" aria-label="Ordenar por">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDENES).map(([valor, { etiqueta }]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>

          {etiquetas.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
              {etiquetas.map((etiqueta) => (
                <li key={etiqueta.clave}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => quitar(etiqueta.clave)}
                  >
                    {etiqueta.texto} <X aria-label="Quitar filtro" />
                  </Button>
                </li>
              ))}
              <li>
                <Button variant="link" size="sm" onClick={() => limpiar(['orden'])}>
                  Limpiar todo
                </Button>
              </li>
            </ul>
          )}

          {productos.isError ? (
            <EstadoError error={productos.error} alReintentar={() => void productos.refetch()} />
          ) : productos.data && productos.data.datos.length === 0 ? (
            <EstadoVacio
              icono={PackageSearch}
              titulo="No encontramos productos"
              descripcion="Prueba con otras palabras o quita algunos filtros."
            >
              <Button variant="outline" onClick={() => limpiar()}>
                Ver todos los productos
              </Button>
            </EstadoVacio>
          ) : (
            <ul
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4"
              aria-busy={productos.isFetching}
            >
              {productos.data
                ? productos.data.datos.map((producto) => (
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
          )}

          {productos.data && (
            <Paginador
              pagina={productos.data.paginacion.pagina}
              totalPaginas={productos.data.paginacion.totalPaginas}
              totalRegistros={productos.data.paginacion.totalRegistros}
              alCambiar={irAPagina}
              className="pt-4"
            />
          )}
        </section>
      </div>
    </div>
  );
}
