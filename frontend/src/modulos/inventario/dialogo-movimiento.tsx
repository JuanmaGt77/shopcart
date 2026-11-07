import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { mensajeDeError } from '@/lib/errores';
import { apiInventario, NOMBRE_MOVIMIENTO, TIPOS_MANUALES, type Existencia } from './api';

/**
 * Movimiento manual de inventario. Siempre pide motivo y la API no deja que la existencia quede
 * negativa ni por debajo de lo reservado (se valida con la fila bloqueada en SQL Server).
 */
export function DialogoMovimiento({
  variante,
  alCerrar,
}: {
  variante: Existencia | null;
  alCerrar: () => void;
}) {
  const cliente = useQueryClient();
  const ids = { cantidad: useId(), motivo: useId() };
  const [tipo, setTipo] = useState<(typeof TIPOS_MANUALES)[number]>('ENTRADA_COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const numero = Number(cantidad);
  const cantidadValida = Number.isInteger(numero) && numero > 0 && numero <= 100_000;
  const esSalida = tipo === 'AJUSTE_SALIDA';
  const maximoSalida = variante ? variante.existencia - variante.reservada : 0;

  const reiniciar = () => {
    setTipo('ENTRADA_COMPRA');
    setCantidad('');
    setMotivo('');
  };

  const registrar = useMutation({
    mutationFn: () =>
      apiInventario.registrarMovimiento({
        idVariante: variante?.idVariante ?? 0,
        tipo,
        cantidad: numero,
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      toast.success(`Movimiento registrado en ${variante?.sku}`);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.inventario] });
      reiniciar();
      alCerrar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Dialog
      open={variante !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          reiniciar();
          alCerrar();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de inventario</DialogTitle>
          <DialogDescription>
            {variante?.nombreProducto} · <span className="font-mono">{variante?.sku}</span>
            <br />
            Existencia {variante?.existencia} · reservada {variante?.reservada} · disponible{' '}
            {variante?.disponible}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)} className="gap-2">
          {TIPOS_MANUALES.map((t) => (
            <Label
              key={t}
              htmlFor={`tipo-${t}`}
              className="flex items-center gap-2 rounded-lg border p-3 font-normal"
            >
              <RadioGroupItem value={t} id={`tipo-${t}`} />
              {NOMBRE_MOVIMIENTO[t]}
              <span className="ml-auto text-xs text-muted-foreground">
                {t === 'AJUSTE_SALIDA' ? 'resta' : 'suma'}
              </span>
            </Label>
          ))}
        </RadioGroup>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.cantidad}>Cantidad</Label>
            <Input
              id={ids.cantidad}
              type="number"
              inputMode="numeric"
              min={1}
              max={esSalida ? maximoSalida : 100_000}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              aria-invalid={cantidad !== '' && !cantidadValida}
            />
            {esSalida && (
              <p className="text-xs text-muted-foreground">
                Puedes restar como máximo {maximoSalida} (no se toca lo reservado por pagos en curso).
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.motivo}>Motivo (obligatorio)</Label>
            <Textarea
              id={ids.motivo}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={250}
              placeholder="Factura del proveedor, conteo físico, producto dañado…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={() => registrar.mutate()}
            disabled={!cantidadValida || motivo.trim().length < 3 || registrar.isPending}
          >
            {registrar.isPending && <Spinner />} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
