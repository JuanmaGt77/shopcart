import { CircleAlert, CircleCheckBig, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, PantallaCarga } from '@/components/compartidos/estados';
import { TablaResponsiva } from '@/components/compartidos/tabla-responsiva';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useConciliacion } from './api';

/** Comprueba que la existencia de cada variante sea igual a la suma de su kardex. */
export function PaginaConciliacion() {
  const [soloDiferencias, setSoloDiferencias] = useState(true);
  const conciliacion = useConciliacion(soloDiferencias);

  if (conciliacion.isPending) return <PantallaCarga texto="Revisando el inventario…" />;
  if (conciliacion.isError) {
    return <EstadoError error={conciliacion.error} alReintentar={() => void conciliacion.refetch()} />;
  }
  const { resumen, variantes } = conciliacion.data;
  const cuadra = resumen.variantesConError === 0;

  return (
    <>
      <EncabezadoPanel descripcion="Existencia guardada en cada variante contra la suma de sus movimientos del kardex. Si alguien cambiara la existencia sin pasar por el kardex, aparecería aquí.">
        <Button
          variant="outline"
          onClick={() => void conciliacion.refetch()}
          disabled={conciliacion.isFetching}
        >
          <RotateCw className={cn(conciliacion.isFetching && 'animate-spin')} /> Revisar de nuevo
        </Button>
      </EncabezadoPanel>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card
          className={cn(
            'sm:col-span-2',
            cuadra ? 'border-exito/40 bg-exito/5' : 'border-destructive/40 bg-destructive/5',
          )}
        >
          <CardContent className="flex items-center gap-3">
            {cuadra ? (
              <CircleCheckBig className="size-8 text-exito" aria-hidden />
            ) : (
              <CircleAlert className="size-8 text-destructive" aria-hidden />
            )}
            <div>
              <p className="font-semibold">
                {cuadra ? 'Todo cuadra' : `${resumen.variantesConError} variante(s) descuadradas`}
              </p>
              <p className="text-sm text-muted-foreground">
                {resumen.variantesRevisadas} variantes revisadas
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Existencia total</p>
            <p className="text-2xl font-bold tabular-nums">
              {resumen.totalExistencia.toLocaleString('es-GT')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Suma del kardex</p>
            <p className="text-2xl font-bold tabular-nums">{resumen.totalKardex.toLocaleString('es-GT')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Switch id="solo-diferencias" checked={soloDiferencias} onCheckedChange={setSoloDiferencias} />
        <Label htmlFor="solo-diferencias">Mostrar solo las que no cuadran</Label>
      </div>

      <TablaResponsiva
        etiqueta="Conciliación por variante"
        filas={variantes}
        claveFila={(v) => v.idVariante}
        columnas={[
          { clave: 'sku', titulo: 'SKU', celda: (v) => <span className="font-mono">{v.sku}</span> },
          { clave: 'existencia', titulo: 'Existencia', celda: (v) => v.existencia, derecha: true },
          { clave: 'kardex', titulo: 'Suma kardex', celda: (v) => v.sumaKardex, derecha: true },
          { clave: 'movimientos', titulo: 'Movimientos', celda: (v) => v.movimientos, derecha: true },
          {
            clave: 'diferencia',
            titulo: 'Diferencia',
            derecha: true,
            celda: (v) => (
              <span className={cn('font-semibold', v.cuadra ? 'text-exito' : 'text-destructive')}>
                {v.cuadra ? 'Cuadra' : v.diferencia}
              </span>
            ),
          },
        ]}
        vacio={
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ninguna variante tiene diferencias.
          </p>
        }
      />
    </>
  );
}
