import { History, Pencil, Plus, TicketPercent, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { BarraFiltros, EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { TablaResponsiva, type Columna } from '@/components/compartidos/tabla-responsiva';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatearFecha, formatearFechaHora, formatearQuetzales } from '@/lib/formato';
import { cn } from '@/lib/utils';
import {
  apiCupones,
  ESTADOS_CUPON,
  NOMBRE_ESTADO_CUPON,
  useCupones,
  useMutacionCupon,
  useUsosCupon,
  type Cupon,
  type EstadoCupon,
} from './api';
import { DialogoCupon } from './dialogo-cupon';

const COLOR_ESTADO: Record<EstadoCupon, string> = {
  VIGENTE: 'bg-exito/15 text-exito',
  PROGRAMADO: 'bg-primary/10 text-primary',
  VENCIDO: 'bg-muted text-muted-foreground',
  AGOTADO: 'bg-advertencia/15 text-amber-700 dark:text-amber-300',
  INACTIVO: 'bg-destructive/10 text-destructive',
};

const esquemaUrl = z.object({
  q: enUrl.texto(),
  estado: enUrl.opcion(ESTADOS_CUPON),
  pagina: enUrl.pagina(),
});

function textoDescuento(c: Cupon): string {
  const base = c.tipoDescuento === 'PORCENTAJE' ? `${c.valor} %` : formatearQuetzales(c.valor);
  return c.descuentoMaximo ? `${base} (tope ${formatearQuetzales(c.descuentoMaximo)})` : base;
}

export function PaginaCupones() {
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const cupones = useCupones(filtros);
  const [editando, setEditando] = useState<{ abierto: boolean; cupon?: Cupon }>({ abierto: false });
  const [usosDe, setUsosDe] = useState<Cupon | null>(null);
  const estado = useMutacionCupon(
    ({ id, activo }: { id: number; activo: boolean }) => apiCupones.estado(id, activo),
    (c) => `${c.codigo}: ${c.activo ? 'activado' : 'desactivado'}`,
  );

  const columnas: Columna<Cupon>[] = [
    {
      clave: 'codigo',
      titulo: 'Cupón',
      celda: (c) => (
        <span className="block max-w-56">
          <span className="block font-mono font-semibold">{c.codigo}</span>
          <span className="block truncate text-xs text-muted-foreground">{c.descripcion}</span>
        </span>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (c) => (
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', COLOR_ESTADO[c.estado])}>
          {NOMBRE_ESTADO_CUPON[c.estado]}
        </span>
      ),
    },
    {
      clave: 'descuento',
      titulo: 'Descuento',
      celda: (c) => (
        <span className="block">
          <span className="block font-medium">{textoDescuento(c)}</span>
          <span className="block text-xs text-muted-foreground">
            {c.montoMinimo > 0 ? `Mínimo ${formatearQuetzales(c.montoMinimo)}` : 'Sin mínimo'}
            {c.categoria && ` · solo ${c.categoria}`}
            {c.limiteUsosPorCliente && ` · ${c.limiteUsosPorCliente} por cliente`}
          </span>
        </span>
      ),
    },
    {
      clave: 'vigencia',
      titulo: 'Vigencia',
      celda: (c) => `${formatearFecha(c.fechaInicio)} – ${formatearFecha(c.fechaFin)}`,
    },
    {
      clave: 'usos',
      titulo: 'Usos',
      derecha: true,
      celda: (c) => `${c.usosActuales}${c.limiteUsosTotal ? ` / ${c.limiteUsosTotal}` : ''}`,
    },
  ];

  return (
    <>
      <EncabezadoPanel descripcion="Un cupón por pedido. El límite de usos se respeta aunque muchos clientes paguen al mismo tiempo, y cada rechazo le dice al cliente el motivo exacto.">
        <Button onClick={() => setEditando({ abierto: true })}>
          <Plus /> Nuevo cupón
        </Button>
      </EncabezadoPanel>

      <BarraFiltros>
        <div className="grid gap-1.5">
          <Label htmlFor="cupones-q" className="text-xs">
            Código o descripción
          </Label>
          <Input
            id="cupones-q"
            type="search"
            className="w-56 bg-background"
            defaultValue={filtros.q ?? ''}
            key={filtros.q ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ q: e.currentTarget.value.trim() })}
            onBlur={(e) =>
              e.currentTarget.value.trim() !== (filtros.q ?? '') &&
              cambiar({ q: e.currentTarget.value.trim() })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cupones-estado" className="text-xs">
            Estado
          </Label>
          <Select
            value={filtros.estado ?? 'todos'}
            onValueChange={(v) => cambiar({ estado: v === 'todos' ? undefined : v })}
          >
            <SelectTrigger id="cupones-estado" className="w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS_CUPON.map((e) => (
                <SelectItem key={e} value={e}>
                  {NOMBRE_ESTADO_CUPON[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filtros.q || filtros.estado) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
      </BarraFiltros>

      {cupones.isError ? (
        <EstadoError error={cupones.error} alReintentar={() => void cupones.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Cupones"
          columnas={columnas}
          filas={cupones.data?.datos}
          claveFila={(c) => c.idCupon}
          cargando={cupones.isFetching}
          acciones={(c) => (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditando({ abierto: true, cupon: c })}>
                <Pencil /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setUsosDe(c)}>
                <History /> Usos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={estado.isPending}
                onClick={() => estado.mutate({ id: c.idCupon, activo: !c.activo })}
              >
                {c.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
          vacio={<EstadoVacio icono={TicketPercent} titulo="No hay cupones con estos filtros" />}
        />
      )}

      {cupones.data && (
        <Paginador
          className="mt-4"
          pagina={cupones.data.paginacion.pagina}
          totalPaginas={cupones.data.paginacion.totalPaginas}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}

      <DialogoCupon
        key={editando.cupon?.idCupon ?? `nuevo-${editando.abierto}`}
        abierto={editando.abierto}
        cupon={editando.cupon}
        alCambiarAbierto={(abierto) => setEditando((d) => ({ ...d, abierto }))}
      />
      <DialogoUsos cupon={usosDe} alCerrar={() => setUsosDe(null)} />
    </>
  );
}

function DialogoUsos({ cupon, alCerrar }: { cupon: Cupon | null; alCerrar: () => void }) {
  const [pagina, setPagina] = useState(1);
  const usos = useUsosCupon(cupon?.idCupon ?? null, pagina);

  return (
    <Dialog
      open={cupon !== null}
      onOpenChange={(a) => {
        if (!a) {
          setPagina(1);
          alCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Usos de {cupon?.codigo}</DialogTitle>
          <DialogDescription>
            Si un pedido se cancela, su uso se revierte y el cupón vuelve a estar disponible.
          </DialogDescription>
        </DialogHeader>
        {usos.data?.datos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Este cupón aún no se ha usado.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usos.data?.datos.map((u) => (
                  <TableRow key={u.idCuponUso}>
                    <TableCell>
                      <Link
                        to={`/panel/pedidos/${u.idPedido}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {u.numeroPedido}
                      </Link>
                      {u.estado !== 'APLICADO' && (
                        <Badge variant="outline" className="ml-2">
                          Revertido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.cliente}</TableCell>
                    <TableCell>{formatearFechaHora(u.fechaUso)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearQuetzales(u.montoDescuento)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {usos.data && (
          <Paginador
            pagina={usos.data.paginacion.pagina}
            totalPaginas={usos.data.paginacion.totalPaginas}
            alCambiar={setPagina}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
