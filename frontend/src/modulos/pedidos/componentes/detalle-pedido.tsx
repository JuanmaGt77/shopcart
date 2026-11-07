import { CreditCard, MapPin, Truck, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatearFechaHora, formatearQuetzales } from '@/lib/formato';
import { ResumenMontos } from '@/modulos/carrito/componentes/resumen-carrito';
import { ImagenProducto } from '@/modulos/catalogo/componentes/imagen-producto';
import type { PedidoDetalle } from '../tipos';
import { LineaTiempo } from './linea-tiempo';

/**
 * Cuerpo del detalle de un pedido; lo comparten el cliente y el personal.
 * El pedido es una "foto" del momento de la compra: precios, descuento y dirección de ese día.
 */
export function DetallePedido({
  pedido,
  esPersonal = false,
  accionesLinea,
}: {
  pedido: PedidoDetalle;
  esPersonal?: boolean;
  /** Columna extra por línea (por ejemplo, cantidad a devolver en el panel). */
  accionesLinea?: (idPedidoDetalle: number) => ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pedido.lineas.map((linea) => (
                <li key={linea.idPedidoDetalle} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="size-14 shrink-0 overflow-hidden rounded-md border">
                    <ImagenProducto url={linea.imagenUrl} alt={linea.nombreProducto} />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{linea.nombreProducto}</p>
                    <p className="text-xs text-muted-foreground">
                      {linea.descripcionVariante ? `${linea.descripcionVariante} · ` : ''}SKU {linea.sku}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {linea.cantidad} × {formatearQuetzales(linea.precioUnitario)}
                      {linea.descuento > 0 && ` · descuento ${formatearQuetzales(linea.descuento)}`}
                    </p>
                    {linea.cantidadDevuelta > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Undo2 className="size-3" aria-hidden /> {linea.cantidadDevuelta} devuelta(s) ·{' '}
                        {formatearQuetzales(linea.montoDevuelto)} reembolsado
                      </p>
                    )}
                    {accionesLinea?.(linea.idPedidoDetalle)}
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatearQuetzales(linea.total)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="pl-8">
            <LineaTiempo
              historial={pedido.historial}
              estadoActual={pedido.estadoCodigo}
              mostrarUsuario={esPersonal}
            />
          </CardContent>
        </Card>

        {pedido.devoluciones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Devoluciones</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {pedido.devoluciones.map((d) => (
                  <li key={d.idDevolucion} className="flex justify-between gap-4 rounded-lg bg-muted/50 p-3">
                    <span>
                      <span className="font-medium">{d.motivo}</span>
                      {(d.fecha ?? d.fechaCreacion) && (
                        <span className="block text-xs text-muted-foreground">
                          {formatearFechaHora(d.fecha ?? d.fechaCreacion ?? '')}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">{formatearQuetzales(d.montoReembolso)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ResumenMontos
              filas={[
                { etiqueta: 'Subtotal', monto: pedido.subtotal },
                {
                  etiqueta: 'Descuento',
                  monto: pedido.descuento,
                  descuento: true,
                  ...(pedido.codigoCupon ? { nota: pedido.codigoCupon } : {}),
                },
                { etiqueta: 'Envío', monto: pedido.costoEnvio },
              ]}
              total={pedido.total}
            />
            <p className="text-xs text-muted-foreground">
              Base imponible {formatearQuetzales(pedido.baseImponible)} · IVA (12 %){' '}
              {formatearQuetzales(pedido.montoIVA)}
            </p>
            {pedido.montoDevuelto > 0 && (
              <p className="text-sm font-medium text-exito">
                Reembolsado: {formatearQuetzales(pedido.montoDevuelto)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {pedido.metodoEnvioNombre}
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-medium text-foreground">{pedido.entregaDestinatario}</span>
                {pedido.entregaTelefono}
                <span className="block">{pedido.entregaDireccion}</span>
              </span>
            </p>
          </CardContent>
        </Card>

        {pedido.pago && (
          <Card>
            <CardHeader>
              <CardTitle>Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" aria-hidden />
                {pedido.pago.marcaTarjeta ?? 'Tarjeta'} •••• {pedido.pago.ultimosDigitos}
              </p>
              <p className="text-xs text-muted-foreground">
                Autorización {pedido.pago.codigoAutorizacion} · {formatearFechaHora(pedido.pago.fechaPago)}
              </p>
              {pedido.pago.montoReembolsado > 0 && (
                <p className="text-xs font-medium text-exito">
                  Reembolsado {formatearQuetzales(pedido.pago.montoReembolsado)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
