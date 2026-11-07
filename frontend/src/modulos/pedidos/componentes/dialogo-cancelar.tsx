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
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { mensajeDeError } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { apiPedidos } from '../api';
import type { PedidoDetalle } from '../tipos';

/** Cancelar antes del despacho: la API reintegra la existencia, devuelve el cupón y reembolsa el pago. */
export function DialogoCancelar({
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
  const [motivo, setMotivo] = useState('');
  const cancelar = useMutation({
    mutationFn: () => apiPedidos.cancelar(pedido.idPedido, motivo.trim()),
    onSuccess: () => {
      toast.success(`Pedido ${pedido.numeroPedido} cancelado`, {
        description: `Se reembolsaron ${formatearQuetzales(pedido.total)} a la tarjeta.`,
      });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedido] });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedidos] });
      alCambiarAbierto(false);
      setMotivo('');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
  const valido = motivo.trim().length >= 3;

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cancelar el pedido {pedido.numeroPedido}?</DialogTitle>
          <DialogDescription>
            Se reembolsa el total ({formatearQuetzales(pedido.total)}), los productos vuelven al inventario y,
            si se usó un cupón, vuelve a quedar disponible. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={idMotivo}>Motivo</Label>
          <Textarea
            id={idMotivo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={250}
            placeholder="Por ejemplo: me equivoqué de presentación"
          />
          <p className="text-xs text-muted-foreground">Mínimo 3 caracteres.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
            No, conservar
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelar.mutate()}
            disabled={!valido || cancelar.isPending}
          >
            {cancelar.isPending && <Spinner />} Sí, cancelar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
