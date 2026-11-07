import { ArrowLeft, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EstadoError, PantallaCarga } from '@/components/compartidos/estados';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { formatearQuetzales } from '@/lib/formato';
import { useProducto } from '../consultas';
import type { ProductoDetalle, Variante } from '../tipos';
import { apiCatalogoAdmin, useMutacionCatalogo, type ImagenEntrada } from './api';
import type { VarianteNueva } from './combinaciones';
import { DialogoNuevaVariante } from './dialogo-nueva-variante';
import { CamposDatos, EditorImagenes, EditorVariantesNuevas, type ValoresDatos } from './editores';
import { datosValidos, imagenesValidas, variantesValidas } from './validaciones';

const aEntrada = (d: ValoresDatos) => ({
  idCategoria: Number(d.idCategoria),
  nombre: d.nombre.trim(),
  marca: d.marca.trim() || null,
  descripcion: d.descripcion.trim() || null,
});

const limpiarImagenes = (imagenes: ImagenEntrada[]) =>
  imagenes
    .filter((i) => i.url.trim())
    .map((i) => ({ url: i.url.trim(), textoAlternativo: i.textoAlternativo?.trim() || null }));

export function PaginaProductoAdmin() {
  const { idProducto } = useParams();
  if (idProducto === 'nuevo') return <NuevoProducto />;
  return <EditarProducto idProducto={Number(idProducto)} />;
}

function Volver() {
  return (
    <Button asChild variant="link" size="sm" className="-ml-2.5">
      <Link to="/panel/productos">
        <ArrowLeft /> Productos
      </Link>
    </Button>
  );
}

function NuevoProducto() {
  const navegar = useNavigate();
  const [datos, setDatos] = useState<ValoresDatos>({
    idCategoria: '',
    nombre: '',
    marca: '',
    descripcion: '',
  });
  const [imagenes, setImagenes] = useState<ImagenEntrada[]>([]);
  const [variantes, setVariantes] = useState<VarianteNueva[]>([]);
  const crear = useMutacionCatalogo(
    () =>
      apiCatalogoAdmin.crearProducto({ ...aEntrada(datos), imagenes: limpiarImagenes(imagenes), variantes }),
    (p) => `Se creó ${p.nombre} con ${p.variantes.length} variante(s)`,
  );
  const valido =
    datosValidos(datos) && imagenesValidas(limpiarImagenes(imagenes)) && variantesValidas(variantes);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Volver />
      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
        </CardHeader>
        <CardContent>
          <CamposDatos valores={datos} alCambiar={setDatos} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
          <CardDescription>
            Por URL (http o https). La primera es la que se ve en el catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditorImagenes imagenes={imagenes} alCambiar={setImagenes} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Variantes</CardTitle>
          <CardDescription>
            Cada variante tiene su SKU, precio y existencia. La existencia inicial entra al kardex como
            compra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditorVariantesNuevas
            nombreProducto={datos.nombre}
            variantes={variantes}
            alCambiar={setVariantes}
          />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          size="xl"
          disabled={!valido || crear.isPending}
          onClick={() =>
            crear.mutate(undefined, {
              onSuccess: (p) => navegar(`/panel/productos/${p.idProducto}`, { replace: true }),
            })
          }
        >
          {crear.isPending ? <Spinner /> : <Save />} Crear producto
        </Button>
      </div>
    </div>
  );
}

function EditarProducto({ idProducto }: { idProducto: number }) {
  const producto = useProducto(idProducto);
  if (producto.isPending) return <PantallaCarga />;
  if (producto.isError)
    return <EstadoError error={producto.error} alReintentar={() => void producto.refetch()} />;
  // key: al cambiar de producto (o recargar sus datos guardados) los formularios arrancan de lo que hay en la base
  return (
    <Editor
      key={`${producto.data.idProducto}-${producto.data.fechaActualizacion ?? ''}`}
      producto={producto.data}
    />
  );
}

function Editor({ producto }: { producto: ProductoDetalle }) {
  const navegar = useNavigate();
  const [datos, setDatos] = useState<ValoresDatos>({
    idCategoria: String(producto.idCategoria),
    nombre: producto.nombre,
    marca: producto.marca ?? '',
    descripcion: producto.descripcion ?? '',
  });
  const [imagenes, setImagenes] = useState<ImagenEntrada[]>(
    [...producto.imagenes]
      .sort((a, b) => a.orden - b.orden)
      .map((i) => ({ url: i.url, textoAlternativo: i.textoAlternativo })),
  );
  const [agregando, setAgregando] = useState(false);

  const guardarDatos = useMutacionCatalogo(
    () => apiCatalogoAdmin.actualizarProducto(producto.idProducto, aEntrada(datos)),
    'Datos guardados',
  );
  const guardarImagenes = useMutacionCatalogo(
    () => apiCatalogoAdmin.reemplazarImagenes(producto.idProducto, limpiarImagenes(imagenes)),
    'Imágenes guardadas',
  );
  const estado = useMutacionCatalogo(
    (activo: boolean) => apiCatalogoAdmin.estadoProducto(producto.idProducto, activo),
    (p) => (p.activo ? 'El producto vuelve a estar a la venta' : 'El producto ya no aparece en la tienda'),
  );
  const eliminar = useMutacionCatalogo(
    () => apiCatalogoAdmin.eliminarProducto(producto.idProducto),
    (r) => r.mensaje,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Volver />
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {producto.nombre}
            {producto.activo ? (
              <Badge variant="secondary">A la venta</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {producto.activo && (
            <Button asChild variant="outline">
              <Link to={`/productos/${producto.idProducto}`} target="_blank">
                <Eye /> Ver en la tienda
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => estado.mutate(!producto.activo)}
            disabled={estado.isPending}
          >
            {producto.activo ? 'Desactivar' : 'Activar'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {producto.nombre}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Si el producto ya tuvo ventas o movimientos de inventario no se borra: se desactiva y deja
                  de verse en la tienda, conservando su historia. Si nunca se usó, se elimina.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    eliminar.mutate(undefined, {
                      onSuccess: (r) =>
                        r.resultado !== 'DESACTIVADO' && navegar('/panel/productos', { replace: true }),
                    })
                  }
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CamposDatos valores={datos} alCambiar={setDatos} />
          <div className="flex justify-end">
            <Button
              onClick={() => guardarDatos.mutate(undefined)}
              disabled={!datosValidos(datos) || guardarDatos.isPending}
            >
              {guardarDatos.isPending ? <Spinner /> : <Save />} Guardar datos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
          <CardDescription>Se reemplaza la galería completa con esta lista.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditorImagenes imagenes={imagenes} alCambiar={setImagenes} />
          <div className="flex justify-end">
            <Button
              onClick={() => guardarImagenes.mutate(undefined)}
              disabled={!imagenesValidas(limpiarImagenes(imagenes)) || guardarImagenes.isPending}
            >
              {guardarImagenes.isPending ? <Spinner /> : <Save />} Guardar imágenes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Variantes</CardTitle>
            <CardDescription>
              Un cambio de precio aplica a las compras nuevas; los pedidos y pagos en curso conservan el
              precio que vio el cliente.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setAgregando(true)}>
            <Plus /> Agregar variante
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {[...producto.variantes]
              .sort((a, b) => a.idVariante - b.idVariante)
              .map((v) => (
                <FilaVariante key={`${v.idVariante}-${v.precio}-${v.activo}`} variante={v} />
              ))}
          </ul>
        </CardContent>
      </Card>

      <DialogoNuevaVariante producto={producto} abierto={agregando} alCambiarAbierto={setAgregando} />
    </div>
  );
}

function FilaVariante({ variante }: { variante: Variante }) {
  const [precio, setPrecio] = useState(String(variante.precio));
  const numero = Number(precio);
  const cambioPrecio = Number.isFinite(numero) && numero > 0 && numero !== variante.precio;
  const guardarPrecio = useMutacionCatalogo(
    () => apiCatalogoAdmin.precioVariante(variante.idVariante, Math.round(numero * 100) / 100),
    `Precio de ${variante.sku} actualizado`,
  );
  const estado = useMutacionCatalogo(
    (activo: boolean) => apiCatalogoAdmin.estadoVariante(variante.idVariante, activo),
    `Variante ${variante.sku} actualizada`,
  );

  return (
    <li className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium">{variante.sku}</p>
        <p className="text-xs text-muted-foreground">{variante.descripcionVariante ?? 'Sin atributos'}</p>
        <p className="text-xs text-muted-foreground">
          Existencia {variante.existencia ?? '—'} · reservada {variante.reservada ?? '—'} · disponible{' '}
          {variante.disponible}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Q</span>
        <Input
          aria-label={`Precio de ${variante.sku}`}
          type="number"
          step="0.01"
          min={0.01}
          className="w-28"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!cambioPrecio || guardarPrecio.isPending}
          onClick={() => guardarPrecio.mutate(undefined)}
        >
          {guardarPrecio.isPending ? <Spinner /> : <Save />} Guardar
        </Button>
      </div>
      <span className="text-xs text-muted-foreground sm:w-24 sm:text-right">
        actual {formatearQuetzales(variante.precio)}
      </span>
      <div className="flex items-center gap-2">
        <Switch
          id={`activa-${variante.idVariante}`}
          checked={variante.activo}
          disabled={estado.isPending}
          onCheckedChange={(activo) => estado.mutate(activo)}
          aria-label={`${variante.sku} a la venta`}
        />
        <label htmlFor={`activa-${variante.idVariante}`} className="text-sm">
          {variante.activo ? 'A la venta' : 'Inactiva'}
        </label>
      </div>
    </li>
  );
}
