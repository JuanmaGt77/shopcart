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
import { apiPedidos } from '../api';
import { NOMBRE_ESTADO_PEDIDO, type CodigoEstadoPedido } from '../estados';
import type { PedidoDetalle } from '../tipos';

/** Avanzar el pedido (preparar, despachar, entregar) con un comentario opcional que queda en el historial. */
export function DialogoCambioEstado({
  pedido,
  destino,
  alCerrar,
}: {
  pedido: PedidoDetalle;
  destino: CodigoEstadoPedido | null;
  alCerrar: () => void;
}) {
  const cliente = useQueryClient();
  const idComentario = useId();
  const [comentario, setComentario] = useState('');
  const cambiar = useMutation({
    mutationFn: () => apiPedidos.cambiarEstado(pedido.idPedido, destino ?? 'EN_PREPARACION', comentario),
    onSuccess: (actualizado) => {
      toast.success(`${actualizado.numeroPedido}: ${NOMBRE_ESTADO_PEDIDO[actualizado.estadoCodigo]}`);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedido] });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedidos] });
      setComentario('');
      alCerrar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Dialog open={destino !== null} onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pedido.numeroPedido} → {destino ? NOMBRE_ESTADO_PEDIDO[destino] : ''}
          </DialogTitle>
          <DialogDescription>
            El cambio queda en el historial con tu nombre y la hora, y el cliente lo ve al instante.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={idComentario}>Comentario para el historial (opcional)</Label>
          <Textarea
            id={idComentario}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={250}
            placeholder={
              destino === 'DESPACHADO' ? 'Guía de envío, transportista o "Listo en la estación"' : ''
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => cambiar.mutate()} disabled={cambiar.isPending}>
            {cambiar.isPending && <Spinner />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
