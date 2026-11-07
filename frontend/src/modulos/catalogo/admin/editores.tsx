import { ImageOff, Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCategorias } from '../consultas';
import type { ImagenEntrada } from './api';
import { generarCombinaciones, separarValores, type VarianteNueva } from './combinaciones';
import { skuValido, urlImagenValida } from './validaciones';

export interface ValoresDatos {
  idCategoria: string;
  nombre: string;
  marca: string;
  descripcion: string;
}

/** Categoría, nombre, marca y descripción. */
export function CamposDatos({
  valores,
  alCambiar,
}: {
  valores: ValoresDatos;
  alCambiar: (v: ValoresDatos) => void;
}) {
  const { data: categorias } = useCategorias(true);
  const set = (campo: keyof ValoresDatos) => (valor: string) => alCambiar({ ...valores, [campo]: valor });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="producto-nombre">Nombre</Label>
        <Input
          id="producto-nombre"
          value={valores.nombre}
          maxLength={150}
          onChange={(e) => set('nombre')(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="producto-categoria">Categoría</Label>
        <Select value={valores.idCategoria} onValueChange={set('idCategoria')}>
          <SelectTrigger id="producto-categoria" className="w-full">
            <SelectValue placeholder="Elige una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categorias?.map((c) => (
              <SelectItem key={c.idCategoria} value={String(c.idCategoria)}>
                {c.nombre}
                {!c.activo && ' (inactiva)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="producto-marca">Marca (opcional)</Label>
        <Input
          id="producto-marca"
          value={valores.marca}
          maxLength={80}
          onChange={(e) => set('marca')(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="producto-descripcion">Descripción (opcional)</Label>
        <Textarea
          id="producto-descripcion"
          value={valores.descripcion}
          maxLength={2000}
          rows={3}
          onChange={(e) => set('descripcion')(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Imágenes por URL (máximo 10), con vista previa. El orden de la lista es el de la galería. */
export function EditorImagenes({
  imagenes,
  alCambiar,
}: {
  imagenes: ImagenEntrada[];
  alCambiar: (imagenes: ImagenEntrada[]) => void;
}) {
  const actualizar = (i: number, cambio: Partial<ImagenEntrada>) =>
    alCambiar(imagenes.map((img, j) => (j === i ? { ...img, ...cambio } : img)));

  return (
    <div className="space-y-3">
      {imagenes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin imágenes: la tienda mostrará el ícono de la categoría.
        </p>
      )}
      {imagenes.map((imagen, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {urlImagenValida(imagen.url) ? (
              <img src={imagen.url} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr]">
            <Input
              aria-label={`URL de la imagen ${i + 1}`}
              placeholder="https://…"
              value={imagen.url}
              maxLength={500}
              aria-invalid={imagen.url !== '' && !urlImagenValida(imagen.url)}
              onChange={(e) => actualizar(i, { url: e.target.value })}
            />
            <Input
              aria-label={`Texto alternativo de la imagen ${i + 1}`}
              placeholder="Texto alternativo"
              value={imagen.textoAlternativo ?? ''}
              maxLength={150}
              onChange={(e) => actualizar(i, { textoAlternativo: e.target.value || null })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar imagen ${i + 1}`}
            onClick={() => alCambiar(imagenes.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {imagenes.length < 10 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => alCambiar([...imagenes, { url: '', textoAlternativo: null }])}
        >
          <Plus /> Agregar imagen
        </Button>
      )}
    </div>
  );
}

interface AtributoTexto {
  nombre: string;
  valores: string;
}

/**
 * Variantes de un producto nuevo: se definen los atributos ("Talla: S, M, L") y se generan
 * todas las combinaciones; después se ajusta el SKU, precio y existencia inicial de cada una.
 */
export function EditorVariantesNuevas({
  nombreProducto,
  variantes,
  alCambiar,
}: {
  nombreProducto: string;
  variantes: VarianteNueva[];
  alCambiar: (v: VarianteNueva[]) => void;
}) {
  const [atributos, setAtributos] = useState<AtributoTexto[]>([{ nombre: '', valores: '' }]);
  const [prefijo, setPrefijo] = useState('');
  const [precio, setPrecio] = useState('');
  const [existencia, setExistencia] = useState('0');

  const generar = () =>
    alCambiar(
      generarCombinaciones(
        atributos.map((a) => ({ nombre: a.nombre, valores: separarValores(a.valores) })),
        prefijo || nombreProducto,
        Number(precio) || 0,
        Math.max(0, Math.trunc(Number(existencia) || 0)),
      ),
    );
  const actualizar = (i: number, cambio: Partial<VarianteNueva>) =>
    alCambiar(variantes.map((v, j) => (j === i ? { ...v, ...cambio } : v)));

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-medium">Atributos</p>
        {atributos.map((a, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Input
              aria-label={`Nombre del atributo ${i + 1}`}
              placeholder="Talla, Color, Presentación…"
              value={a.nombre}
              maxLength={50}
              onChange={(e) =>
                setAtributos(atributos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
              }
            />
            <Input
              aria-label={`Valores del atributo ${i + 1}, separados por coma`}
              placeholder="Valores separados por coma: S, M, L, XL"
              value={a.valores}
              onChange={(e) =>
                setAtributos(atributos.map((x, j) => (j === i ? { ...x, valores: e.target.value } : x)))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Quitar atributo ${i + 1}`}
              onClick={() => setAtributos(atributos.filter((_, j) => j !== i))}
              disabled={atributos.length === 1}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {atributos.length < 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAtributos([...atributos, { nombre: '', valores: '' }])}
          >
            <Plus /> Otro atributo
          </Button>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto] sm:items-end">
          <div className="grid gap-1">
            <Label htmlFor="sku-prefijo" className="text-xs">
              Prefijo del SKU
            </Label>
            <Input
              id="sku-prefijo"
              placeholder="LUBSIN"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="precio-base" className="text-xs">
              Precio (Q)
            </Label>
            <Input
              id="precio-base"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="existencia-base" className="text-xs">
              Existencia inicial
            </Label>
            <Input
              id="existencia-base"
              type="number"
              inputMode="numeric"
              min={0}
              value={existencia}
              onChange={(e) => setExistencia(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={generar}>
            <Wand2 /> Generar variantes
          </Button>
        </div>
      </div>

      {variantes.length > 0 && (
        <TablaVariantesNuevas variantes={variantes} actualizar={actualizar} alCambiar={alCambiar} />
      )}
    </div>
  );
}

function TablaVariantesNuevas({
  variantes,
  actualizar,
  alCambiar,
}: {
  variantes: VarianteNueva[];
  actualizar: (i: number, cambio: Partial<VarianteNueva>) => void;
  alCambiar: (v: VarianteNueva[]) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {variantes.map((v, i) => (
        <li key={i} className="grid items-center gap-2 p-2 sm:grid-cols-[1fr_200px_110px_100px_auto]">
          <span className="text-sm">
            {Object.entries(v.atributos)
              .map(([n, val]) => `${n}: ${val}`)
              .join(' / ') || 'Sin atributos'}
          </span>
          <Input
            aria-label="SKU"
            className="font-mono uppercase"
            value={v.sku}
            maxLength={40}
            aria-invalid={!skuValido(v.sku)}
            onChange={(e) => actualizar(i, { sku: e.target.value.toUpperCase() })}
          />
          <Input
            aria-label="Precio"
            type="number"
            step="0.01"
            min={0.01}
            value={v.precio || ''}
            aria-invalid={!(v.precio > 0)}
            onChange={(e) => actualizar(i, { precio: Number(e.target.value) })}
          />
          <Input
            aria-label="Existencia inicial"
            type="number"
            min={0}
            value={v.existenciaInicial}
            onChange={(e) =>
              actualizar(i, { existenciaInicial: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Quitar variante"
            onClick={() => alCambiar(variantes.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
