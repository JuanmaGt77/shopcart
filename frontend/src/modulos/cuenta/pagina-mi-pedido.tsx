import { ArrowLeft, CircleCheckBig, PackageX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { EstadoError, EstadoVacio, PantallaCarga } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import { esErrorApi } from '@/lib/errores';
import { formatearFechaHora } from '@/lib/formato';
import { usePedido } from '@/modulos/pedidos/api';
import { DetallePedido } from '@/modulos/pedidos/componentes/detalle-pedido';
import { DialogoCancelar } from '@/modulos/pedidos/componentes/dialogo-cancelar';
import { InsigniaEstado } from '@/modulos/pedidos/componentes/insignia-estado';
import { esCancelable } from '@/modulos/pedidos/estados';
import { IndicadorConexion } from '@/tiempo-real/indicador-conexion';

export function PaginaMiPedido() {
  const idPedido = Number(useParams().idPedido);
  const [parametros] = useSearchParams();
  const esNuevo = parametros.get('nuevo') === '1';
  const pedido = usePedido(idPedido);
  const [cancelando, setCancelando] = useState(false);

  if (pedido.isPending) return <PantallaCarga />;
  if (pedido.isError) {
    // Un pedido de otra persona responde 403: se muestra igual que uno que no existe
    return esErrorApi(
      pedido.error,
      'ACCESO_DENEGADO',
      'PEDIDO_NO_ENCONTRADO',
      'NO_ENCONTRADO',
      'VALIDACION',
    ) ? (
      <EstadoVacio icono={PackageX} titulo="No encontramos este pedido" descripcion="Revisa tus pedidos.">
        <Button asChild>
          <Link to="/cuenta/pedidos">Ver mis pedidos</Link>
        </Button>
      </EstadoVacio>
    ) : (
      <EstadoError error={pedido.error} alReintentar={() => void pedido.refetch()} />
    );
  }

  const datos = pedido.data;
  return (
    <div className="space-y-6">
      {esNuevo && (
        <div className="flex items-start gap-3 rounded-xl border border-exito/30 bg-exito/10 p-4">
          <CircleCheckBig className="mt-0.5 size-6 shrink-0 text-exito" aria-hidden />
          <div>
            <p className="font-semibold">¡Gracias por tu compra!</p>
            <p className="text-sm text-muted-foreground">
              Tu pago se aprobó y recibimos el pedido {datos.numeroPedido}. Aquí verás en vivo cada vez que
              cambie de estado.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="link" size="sm" className="-ml-2.5">
            <Link to="/cuenta/pedidos">
              <ArrowLeft /> Mis pedidos
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
            Pedido <span className="font-mono">{datos.numeroPedido}</span>
            <InsigniaEstado estado={datos.estadoCodigo} className="text-sm" />
          </h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {formatearFechaHora(datos.fechaCreacion)}
            <IndicadorConexion />
          </p>
        </div>
        {esCancelable(datos.estadoCodigo) && (
          <Button variant="destructive" onClick={() => setCancelando(true)}>
            Cancelar pedido
          </Button>
        )}
      </div>

      <DetallePedido pedido={datos} />
      <DialogoCancelar pedido={datos} abierto={cancelando} alCambiarAbierto={setCancelando} />
    </div>
  );
}
