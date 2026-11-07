import { Package, Pencil, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
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
import { ImagenProducto } from '../componentes/imagen-producto';
import { useCategorias, useProductos } from '../consultas';
import type { ProductoResumen } from '../tipos';
import { apiCatalogoAdmin, useMutacionCatalogo } from './api';

const esquemaUrl = z.object({
  q: enUrl.texto(),
  idCategoria: enUrl.entero(),
  soloActivos: enUrl.bandera(),
  pagina: enUrl.pagina(),
});

export function PaginaProductosAdmin() {
  const navegar = useNavigate();
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const { data: categorias } = useCategorias(true);
  const productos = useProductos({
    q: filtros.q,
    idCategoria: filtros.idCategoria,
    incluirInactivos: !filtros.soloActivos,
    ordenarPor: 'nombre',
    direccion: 'asc',
    pagina: filtros.pagina,
    tamanoPagina: 20,
  });
  const estado = useMutacionCatalogo(
    ({ id, activo }: { id: number; activo: boolean }) => apiCatalogoAdmin.estadoProducto(id, activo),
    (p) => (p.activo ? `${p.nombre} vuelve a estar a la venta` : `${p.nombre} ya no aparece en la tienda`),
  );

  const columnas: Columna<ProductoResumen>[] = [
    {
      clave: 'producto',
      titulo: 'Producto',
      celda: (p) => (
        <span className="flex items-center gap-3">
          <span className="size-10 shrink-0 overflow-hidden rounded-md border">
            <ImagenProducto url={p.imagenUrl} alt="" categoria={p.categoria} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.nombre}</span>
            <span className="block text-xs text-muted-foreground">{p.marca ?? 'Sin marca'}</span>
          </span>
        </span>
      ),
    },
    { clave: 'categoria', titulo: 'Categoría', celda: (p) => p.categoria },
    {
      clave: 'precio',
      titulo: 'Precio',
      derecha: true,
      celda: (p) =>
        p.precioMaximo > p.precioMinimo
          ? `${formatearQuetzales(p.precioMinimo)} – ${formatearQuetzales(p.precioMaximo)}`
          : formatearQuetzales(p.precioMinimo),
    },
    {
      clave: 'variantes',
      titulo: 'Variantes',
      celda: (p) => p.cantidadVariantes,
      derecha: true,
      soloEscritorio: true,
    },
    { clave: 'disponible', titulo: 'Disponible', celda: (p) => p.disponible, derecha: true },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (p) =>
        p.activo ? <Badge variant="secondary">A la venta</Badge> : <Badge variant="outline">Inactivo</Badge>,
    },
  ];

  return (
    <>
      <EncabezadoPanel descripcion="Alta y edición del catálogo. Un producto con ventas no se borra: se desactiva y deja de verse en la tienda, conservando su historia.">
        <Button asChild>
          <Link to="/panel/productos/nuevo">
            <Plus /> Nuevo producto
          </Link>
        </Button>
      </EncabezadoPanel>

      <BarraFiltros>
        <div className="grid gap-1.5">
          <Label htmlFor="productos-q" className="text-xs">
            Buscar
          </Label>
          <Input
            id="productos-q"
            type="search"
            className="w-60 bg-background"
            placeholder="Nombre, marca o descripción"
            defaultValue={filtros.q ?? ''}
            key={filtros.q ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ q: e.currentTarget.value.trim() })}
            onBlur={(e) =>
              e.currentTarget.value.trim() !== (filtros.q ?? '') &&
              cambiar({ q: e.currentTarget.value.trim() })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="productos-categoria" className="text-xs">
            Categoría
          </Label>
          <Select
            value={filtros.idCategoria?.toString() ?? 'todas'}
            onValueChange={(v) => cambiar({ idCategoria: v === 'todas' ? undefined : v })}
          >
            <SelectTrigger id="productos-categoria" className="w-52 bg-background">
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
            id="solo-activos"
            checked={filtros.soloActivos ?? false}
            onCheckedChange={(v) => cambiar({ soloActivos: v || undefined })}
          />
          <Label htmlFor="solo-activos">Solo a la venta</Label>
        </div>
        {(filtros.q || filtros.idCategoria || filtros.soloActivos) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
      </BarraFiltros>

      {productos.isError ? (
        <EstadoError error={productos.error} alReintentar={() => void productos.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Productos"
          columnas={columnas}
          filas={productos.data?.datos}
          claveFila={(p) => p.idProducto}
          alAbrir={(p) => navegar(`/panel/productos/${p.idProducto}`)}
          cargando={productos.isFetching}
          acciones={(p) => (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to={`/panel/productos/${p.idProducto}`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={estado.isPending}
                onClick={() => estado.mutate({ id: p.idProducto, activo: !p.activo })}
              >
                {p.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
          vacio={<EstadoVacio icono={Package} titulo="No hay productos con estos filtros" />}
        />
      )}

      {productos.data && (
        <Paginador
          className="mt-4"
          pagina={productos.data.paginacion.pagina}
          totalPaginas={productos.data.paginacion.totalPaginas}
          totalRegistros={productos.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}
    </>
  );
}
