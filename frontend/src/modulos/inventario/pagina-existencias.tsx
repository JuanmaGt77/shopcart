import { ArrowLeftRight, Boxes, History, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { BarraFiltros, EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { TablaResponsiva, type Columna } from '@/components/compartidos/tabla-responsiva';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatearQuetzales } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { useCategorias } from '@/modulos/catalogo/consultas';
import { useExistencias, type Existencia } from './api';
import { DialogoMovimiento } from './dialogo-movimiento';

const esquemaUrl = z.object({
  q: enUrl.texto(),
  idCategoria: enUrl.entero(),
  bajoStock: enUrl.bandera(),
  pagina: enUrl.pagina(),
});

const COLUMNAS: Columna<Existencia>[] = [
  {
    clave: 'producto',
    titulo: 'Producto',
    celda: (e) => (
      <span className="block max-w-72">
        <span className="block truncate font-medium">{e.nombreProducto}</span>
        <span className="block truncate text-xs text-muted-foreground">
          <span className="font-mono">{e.sku}</span>
          {e.descripcionVariante && ` · ${e.descripcionVariante}`}
        </span>
      </span>
    ),
  },
  { clave: 'categoria', titulo: 'Categoría', celda: (e) => e.categoria, soloEscritorio: true },
  {
    clave: 'precio',
    titulo: 'Precio',
    celda: (e) => formatearQuetzales(e.precio),
    derecha: true,
    soloEscritorio: true,
  },
  { clave: 'existencia', titulo: 'Existencia', celda: (e) => e.existencia, derecha: true },
  { clave: 'reservada', titulo: 'Reservada', celda: (e) => e.reservada, derecha: true },
  {
    clave: 'disponible',
    titulo: 'Disponible',
    derecha: true,
    celda: (e) => (
      <span className={cn('font-semibold', e.bajoStock && 'text-promo')}>
        {e.disponible}
        {e.bajoStock && (
          <Badge variant="outline" className="ml-2 border-promo/40 text-promo">
            Bajo
          </Badge>
        )}
        {(!e.varianteActiva || !e.productoActivo) && (
          <Badge variant="secondary" className="ml-2">
            Inactivo
          </Badge>
        )}
      </span>
    ),
  },
];

export function PaginaExistencias() {
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const { data: categorias } = useCategorias(true);
  const [seleccionada, setSeleccionada] = useState<Existencia | null>(null);
  const existencias = useExistencias({ ...filtros, tamanoPagina: 25 });

  return (
    <>
      <EncabezadoPanel descripcion="Existencia física, lo reservado por pagos en curso y lo disponible para vender, actualizado en vivo. Toda entrada o salida queda en el kardex." />

      <BarraFiltros>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-q" className="text-xs">
            Producto o SKU
          </Label>
          <Input
            id="filtro-q"
            type="search"
            className="w-60 bg-background"
            defaultValue={filtros.q ?? ''}
            key={filtros.q ?? ''}
            placeholder="Aceite, LUBSIN…"
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ q: e.currentTarget.value.trim() })}
            onBlur={(e) =>
              e.currentTarget.value.trim() !== (filtros.q ?? '') &&
              cambiar({ q: e.currentTarget.value.trim() })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-categoria" className="text-xs">
            Categoría
          </Label>
          <Select
            value={filtros.idCategoria?.toString() ?? 'todas'}
            onValueChange={(v) => cambiar({ idCategoria: v === 'todas' ? undefined : v })}
          >
            <SelectTrigger id="filtro-categoria" className="w-52 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias?.map((c) => (
                <SelectItem key={c.idCategoria} value={String(c.idCategoria)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Switch
            id="filtro-bajo"
            checked={filtros.bajoStock ?? false}
            onCheckedChange={(v) => cambiar({ bajoStock: v || undefined })}
          />
          <Label htmlFor="filtro-bajo">Solo existencia baja</Label>
        </div>
        {(filtros.q || filtros.idCategoria || filtros.bajoStock) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
      </BarraFiltros>

      {existencias.isError ? (
        <EstadoError error={existencias.error} alReintentar={() => void existencias.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Existencias"
          columnas={COLUMNAS}
          filas={existencias.data?.datos}
          claveFila={(e) => e.idVariante}
          cargando={existencias.isFetching}
          acciones={(e) => (
            <>
              <Button variant="outline" size="sm" onClick={() => setSeleccionada(e)}>
                <ArrowLeftRight /> Movimiento
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link
                  to={`/panel/inventario/kardex?idVariante=${e.idVariante}&sku=${encodeURIComponent(e.sku)}`}
                >
                  <History /> Kardex
                </Link>
              </Button>
            </>
          )}
          vacio={<EstadoVacio icono={Boxes} titulo="No hay variantes con estos filtros" />}
        />
      )}

      {existencias.data && (
        <Paginador
          className="mt-4"
          pagina={existencias.data.paginacion.pagina}
          totalPaginas={existencias.data.paginacion.totalPaginas}
          totalRegistros={existencias.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}

      <DialogoMovimiento variante={seleccionada} alCerrar={() => setSeleccionada(null)} />
    </>
  );
}
