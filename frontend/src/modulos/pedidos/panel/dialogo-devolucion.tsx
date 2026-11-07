import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
import { SelectorCantidad } from '@/components/compartidos/selector-cantidad';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { mensajeDeError } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { apiPedidos } from '../api';
import type { PedidoDetalle } from '../tipos';

/**
 * Devolución por línea. Solo se ofrecen las unidades que aún se pueden devolver
 * (vendido - ya devuelto); la API calcula el reembolso proporcional y reintegra la existencia.
 */
export function DialogoDevolucion({
  pedido,
  abierto,
  alCambiarAbierto,
}: {
  pedido: PedidoDetalle;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const cliente = useQueryClient();
  const idMotivo = useId();
  const devolvibles = pedido.lineas.filter((l) => l.cantidadDevolvible > 0);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [motivo, setMotivo] = useState('');

  const lineas = Object.entries(cantidades)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([id, cantidad]) => ({ idPedidoDetalle: Number(id), cantidad }));

  const devolver = useMutation({
    mutationFn: () => apiPedidos.devolver(pedido.idPedido, motivo.trim(), lineas),
    onSuccess: (actualizado) => {
      toast.success('Devolución registrada', {
        description: `Total reembolsado en el pedido: ${formatearQuetzales(actualizado.montoDevuelto)}`,
      });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedido] });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedidos] });
      setCantidades({});
      setMotivo('');
      alCambiarAbierto(false);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar devolución · {pedido.numeroPedido}</DialogTitle>
          <DialogDescription>
            Marca lo que el cliente devolvió. Vuelve al inventario y se reembolsa la parte proporcional de
            cada línea (con su descuento). Si se devuelve todo, también se reembolsa el envío.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {devolvibles.map((linea) => {
            const cantidad = cantidades[linea.idPedidoDetalle] ?? 0;
            const id = `devolver-${linea.idPedidoDetalle}`;
            return (
              <li key={linea.idPedidoDetalle} className="flex flex-wrap items-center gap-3 p-3">
                <Checkbox
                  id={id}
                  checked={cantidad > 0}
                  onCheckedChange={(marcado) =>
                    setCantidades((c) => ({
                      ...c,
                      [linea.idPedidoDetalle]: marcado ? linea.cantidadDevolvible : 0,
                    }))
                  }
                />
                <Label htmlFor={id} className="min-w-0 flex-1 flex-col items-start gap-0 font-normal">
                  <span className="font-medium">{linea.nombreProducto}</span>
                  <span className="text-xs text-muted-foreground">
                    {linea.descripcionVariante ?? linea.sku} · se pueden devolver {linea.cantidadDevolvible}{' '}
                    de {linea.cantidad}
                  </span>
                </Label>
                <SelectorCantidad
                  tamano="compacto"
                  valor={Math.max(cantidad, 1)}
                  maximo={linea.cantidadDevolvible}
                  deshabilitado={cantidad === 0}
                  alCambiar={(valor) => setCantidades((c) => ({ ...c, [linea.idPedidoDetalle]: valor }))}
                  etiqueta={`Unidades de ${linea.nombreProducto} a devolver`}
                />
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <Label htmlFor={idMotivo}>Motivo</Label>
          <Textarea
            id={idMotivo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={250}
            placeholder="Por ejemplo: producto equivocado, empaque dañado…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => devolver.mutate()}
            disabled={lineas.length === 0 || motivo.trim().length < 3 || devolver.isPending}
          >
            {devolver.isPending && <Spinner />} Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
