import {
  ArrowLeft,
  Ban,
  PackageCheck,
  PackageOpen,
  PackageX,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EstadoError, EstadoVacio, PantallaCarga } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import { esErrorApi } from '@/lib/errores';
import { formatearFechaHora } from '@/lib/formato';
import { useEstadosPedido } from '@/modulos/sistema/catalogos';
import { usePedido } from '../api';
import { DetallePedido } from '../componentes/detalle-pedido';
import { DialogoCancelar } from '../componentes/dialogo-cancelar';
import { InsigniaEstado } from '../componentes/insignia-estado';
import type { CodigoEstadoPedido } from '../estados';
import { DialogoCambioEstado } from './dialogo-cambio-estado';
import { DialogoDevolucion } from './dialogo-devolucion';

/** Estados a los que se avanza con "cambiar estado" (cancelar y devolver tienen su propio flujo). */
const AVANCES: Partial<Record<CodigoEstadoPedido, { texto: string; icono: LucideIcon }>> = {
  EN_PREPARACION: { texto: 'Iniciar preparación', icono: PackageOpen },
  DESPACHADO: { texto: 'Marcar como despachado', icono: Truck },
  ENTREGADO: { texto: 'Marcar como entregado', icono: PackageCheck },
};

export function PaginaPedidoPanel() {
  const idPedido = Number(useParams().idPedido);
  const pedido = usePedido(idPedido);
  const estados = useEstadosPedido();
  const [destino, setDestino] = useState<CodigoEstadoPedido | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);

  if (pedido.isPending) return <PantallaCarga />;
  if (pedido.isError) {
    return esErrorApi(pedido.error, 'PEDIDO_NO_ENCONTRADO', 'NO_ENCONTRADO', 'VALIDACION') ? (
      <EstadoVacio icono={PackageX} titulo="Este pedido no existe">
        <Button asChild variant="outline">
          <Link to="/panel/pedidos">Volver a pedidos</Link>
        </Button>
      </EstadoVacio>
    ) : (
      <EstadoError error={pedido.error} alReintentar={() => void pedido.refetch()} />
    );
  }

  const datos = pedido.data;
  // Transiciones permitidas desde el estado actual, según la tabla EstadoPedidoTransicion
  const siguientes =
    estados.data?.find((e) => e.codigo === datos.estadoCodigo)?.siguientes.map((s) => s.codigo) ?? [];
  const avances = siguientes.filter((c): c is CodigoEstadoPedido => c in AVANCES);
  const puedeCancelar = siguientes.includes('CANCELADO');
  const puedeDevolver =
    (siguientes.includes('DEVUELTO') || siguientes.includes('DEVUELTO_PARCIAL')) &&
    datos.lineas.some((l) => l.cantidadDevolvible > 0);
  const esRecoger = datos.metodoEnvioNombre.toLocaleLowerCase('es').includes('recoger');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="link" size="sm" className="-ml-2.5">
            <Link to="/panel/pedidos">
              <ArrowLeft /> Pedidos
            </Link>
          </Button>
          <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="font-mono">{datos.numeroPedido}</span>
            <InsigniaEstado estado={datos.estadoCodigo} className="text-sm" />
          </h2>
          <p className="text-sm text-muted-foreground">
            {datos.cliente} · {datos.correoCliente} · {formatearFechaHora(datos.fechaCreacion)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {avances.map((codigo) => {
            const avance = AVANCES[codigo];
            if (!avance) return null;
            const Icono = avance.icono;
            return (
              <Button key={codigo} onClick={() => setDestino(codigo)}>
                <Icono />
                {codigo === 'DESPACHADO' && esRecoger ? 'Listo para recoger' : avance.texto}
              </Button>
            );
          })}
          {puedeDevolver && (
            <Button variant="outline" onClick={() => setDevolviendo(true)}>
              <Undo2 /> Registrar devolución
            </Button>
          )}
          {puedeCancelar && (
            <Button variant="destructive" onClick={() => setCancelando(true)}>
              <Ban /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <DetallePedido pedido={datos} esPersonal />

      <DialogoCambioEstado pedido={datos} destino={destino} alCerrar={() => setDestino(null)} />
      <DialogoCancelar pedido={datos} abierto={cancelando} alCambiarAbierto={setCancelando} />
      <DialogoDevolucion pedido={datos} abierto={devolviendo} alCambiarAbierto={setDevolviendo} />
    </div>
  );
}
