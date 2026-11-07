import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { atributosDe } from '../seleccion-variante';
import type { ProductoDetalle } from '../tipos';
import { apiCatalogoAdmin, useMutacionCatalogo } from './api';
import { codigoParaSku } from './combinaciones';
import { skuValido } from './validaciones';

/** Agrega una variante a un producto que ya existe, con los mismos atributos que sus hermanas. */
export function DialogoNuevaVariante({
  producto,
  abierto,
  alCambiarAbierto,
}: {
  producto: ProductoDetalle;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const atributos = atributosDe(producto.variantes.map((v) => ({ ...v, activo: true })));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [sku, setSku] = useState('');
  const [precio, setPrecio] = useState('');
  const [existencia, setExistencia] = useState('0');

  const prefijo = producto.variantes[0]?.sku.split('-')[0] ?? codigoParaSku(producto.nombre).slice(0, 8);
  const skuSugerido = [prefijo, ...atributos.map((a) => codigoParaSku(valores[a.nombre] ?? ''))]
    .filter(Boolean)
    .join('-');
  const skuFinal = (sku || skuSugerido).toUpperCase();
  const completo = atributos.every((a) => (valores[a.nombre] ?? '').trim());
  const valido = completo && skuValido(skuFinal) && Number(precio) > 0;

  const agregar = useMutacionCatalogo(
    () =>
      apiCatalogoAdmin.agregarVariante(producto.idProducto, {
        sku: skuFinal,
        precio: Math.round(Number(precio) * 100) / 100,
        existenciaInicial: Math.max(0, Math.trunc(Number(existencia) || 0)),
        atributos: Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim()])),
      }),
    `Variante ${skuFinal} agregada`,
  );

  const cerrar = () => {
    setValores({});
    setSku('');
    setPrecio('');
    setExistencia('0');
    alCambiarAbierto(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => (a ? alCambiarAbierto(true) : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva variante · {producto.nombre}</DialogTitle>
          <DialogDescription>La existencia inicial entra al kardex como compra.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {atributos.map((a) => (
            <div key={a.nombre} className="grid gap-1.5">
              <Label htmlFor={`atributo-${a.nombre}`}>{a.nombre}</Label>
              <Input
                id={`atributo-${a.nombre}`}
                list={`valores-${a.nombre}`}
                value={valores[a.nombre] ?? ''}
                maxLength={50}
                placeholder={a.valores.join(', ')}
                onChange={(e) => setValores({ ...valores, [a.nombre]: e.target.value })}
              />
              <datalist id={`valores-${a.nombre}`}>
                {a.valores.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </datalist>
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="variante-sku">SKU</Label>
            <Input
              id="variante-sku"
              className="font-mono uppercase"
              placeholder={skuSugerido}
              value={sku}
              maxLength={40}
              aria-invalid={sku !== '' && !skuValido(skuFinal)}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejas vacío se usa {skuSugerido || 'el sugerido'}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="variante-precio">Precio (Q)</Label>
              <Input
                id="variante-precio"
                type="number"
                step="0.01"
                min={0.01}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="variante-existencia">Existencia inicial</Label>
              <Input
                id="variante-existencia"
                type="number"
                min={0}
                value={existencia}
                onChange={(e) => setExistencia(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || agregar.isPending}
            onClick={() => agregar.mutate(undefined, { onSuccess: cerrar })}
          >
            {agregar.isPending && <Spinner />} Agregar variante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
