import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileClock, X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
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
import { finDelDia, inicioDelDia } from '@/lib/fechas';
import { formatearFechaHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { compararValores } from './comparar';

const MODULOS = ['CATALOGO', 'INVENTARIO', 'CUPONES', 'PEDIDOS', 'USUARIOS', 'SISTEMA'] as const;
const ACCIONES = [
  'CREAR',
  'MODIFICAR',
  'ACTIVAR',
  'DESACTIVAR',
  'ELIMINAR',
  'CAMBIO_PRECIO',
  'CAMBIO_EXISTENCIA',
  'CAMBIO_ESTADO',
] as const;

const NOMBRE_ACCION: Record<(typeof ACCIONES)[number], string> = {
  CREAR: 'Crear',
  MODIFICAR: 'Modificar',
  ACTIVAR: 'Activar',
  DESACTIVAR: 'Desactivar',
  ELIMINAR: 'Eliminar',
  CAMBIO_PRECIO: 'Cambio de precio',
  CAMBIO_EXISTENCIA: 'Cambio de existencia',
  CAMBIO_ESTADO: 'Cambio de estado',
};

interface RegistroBitacora {
  idBitacora: number;
  modulo: string;
  entidad: string;
  idEntidad: string | number | null;
  accion: (typeof ACCIONES)[number];
  valorAnterior: unknown;
  valorNuevo: unknown;
  idUsuario: number | null;
  usuario: string | null;
  correoUsuario: string | null;
  usuarioBD: string | null;
  fecha: string;
}

const esquemaUrl = z.object({
  modulo: enUrl.opcion(MODULOS),
  accion: enUrl.opcion(ACCIONES),
  entidad: enUrl.texto(40),
  idEntidad: enUrl.texto(40),
  desde: enUrl.texto(10),
  hasta: enUrl.texto(10),
  pagina: enUrl.pagina(),
});

const COLUMNAS: Columna<RegistroBitacora>[] = [
  { clave: 'fecha', titulo: 'Fecha', celda: (r) => formatearFechaHora(r.fecha) },
  { clave: 'modulo', titulo: 'Módulo', celda: (r) => <Badge variant="outline">{r.modulo}</Badge> },
  {
    clave: 'entidad',
    titulo: 'Registro',
    celda: (r) => (
      <span className="font-mono text-xs">
        {r.entidad} #{r.idEntidad}
      </span>
    ),
  },
  { clave: 'accion', titulo: 'Acción', celda: (r) => NOMBRE_ACCION[r.accion] ?? r.accion },
  { clave: 'usuario', titulo: 'Usuario', celda: (r) => r.usuario ?? 'Sistema' },
];

/** La bitácora es de solo lectura: ni la API ni la base permiten modificarla o borrarla. */
export function PaginaBitacora() {
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const [detalle, setDetalle] = useState<RegistroBitacora | null>(null);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);

  const registros = useQuery({
    queryKey: [PREFIJO.bitacora, filtros],
    queryFn: ({ signal }) =>
      pedirPaginado<RegistroBitacora>('/bitacora', {
        consulta: {
          modulo: filtros.modulo,
          accion: filtros.accion,
          entidad: filtros.entidad,
          idEntidad: filtros.idEntidad,
          desde: rangoInvalido ? undefined : inicioDelDia(filtros.desde),
          hasta: rangoInvalido ? undefined : finDelDia(filtros.hasta),
          pagina: filtros.pagina,
          tamanoPagina: 25,
        },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <EncabezadoPanel descripcion="Quién cambió qué y cuándo: productos, precios, existencias, cupones, usuarios, parámetros y estados de pedidos. Abre un registro para ver el valor anterior y el nuevo." />

      <BarraFiltros>
        <FiltroSelect
          id="bitacora-modulo"
          etiqueta="Módulo"
          valor={filtros.modulo}
          opciones={MODULOS.map((m) => [m, m])}
          alCambiar={(v) => cambiar({ modulo: v })}
        />
        <FiltroSelect
          id="bitacora-accion"
          etiqueta="Acción"
          valor={filtros.accion}
          opciones={ACCIONES.map((a) => [a, NOMBRE_ACCION[a]])}
          alCambiar={(v) => cambiar({ accion: v })}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="bitacora-entidad" className="text-xs">
            Entidad
          </Label>
          <Input
            id="bitacora-entidad"
            className="w-36 bg-background"
            placeholder="Variante, Cupon…"
            defaultValue={filtros.entidad ?? ''}
            key={filtros.entidad ?? ''}
            onBlur={(e) => cambiar({ entidad: e.currentTarget.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ entidad: e.currentTarget.value.trim() })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bitacora-id" className="text-xs">
            ID
          </Label>
          <Input
            id="bitacora-id"
            className="w-24 bg-background"
            defaultValue={filtros.idEntidad ?? ''}
            key={filtros.idEntidad ?? ''}
            onBlur={(e) => cambiar({ idEntidad: e.currentTarget.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ idEntidad: e.currentTarget.value.trim() })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bitacora-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="bitacora-desde"
            type="date"
            className="w-40 bg-background"
            value={filtros.desde ?? ''}
            onChange={(e) => cambiar({ desde: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bitacora-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="bitacora-hasta"
            type="date"
            className="w-40 bg-background"
            value={filtros.hasta ?? ''}
            onChange={(e) => cambiar({ hasta: e.target.value })}
          />
        </div>
        {Object.entries(filtros).some(([k, v]) => k !== 'pagina' && v) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
      </BarraFiltros>

      {registros.isError ? (
        <EstadoError error={registros.error} alReintentar={() => void registros.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Bitácora"
          columnas={COLUMNAS}
          filas={registros.data?.datos}
          claveFila={(r) => r.idBitacora}
          alAbrir={setDetalle}
          cargando={registros.isFetching}
          vacio={<EstadoVacio icono={FileClock} titulo="No hay registros con estos filtros" />}
        />
      )}

      {registros.data && (
        <Paginador
          className="mt-4"
          pagina={registros.data.paginacion.pagina}
          totalPaginas={registros.data.paginacion.totalPaginas}
          totalRegistros={registros.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}

      <Dialog open={detalle !== null} onOpenChange={(a) => !a && setDetalle(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {NOMBRE_ACCION[detalle.accion] ?? detalle.accion} · {detalle.entidad} #{detalle.idEntidad}
                </DialogTitle>
                <DialogDescription>
                  {formatearFechaHora(detalle.fecha)} · {detalle.usuario ?? 'Sistema'}
                  {detalle.correoUsuario && ` (${detalle.correoUsuario})`}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60svh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Después</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compararValores(detalle.valorAnterior, detalle.valorNuevo).map((fila) => (
                      <TableRow key={fila.campo} className={cn(fila.cambio && 'bg-advertencia/10')}>
                        <TableCell className="font-medium">{fila.campo}</TableCell>
                        <TableCell className="font-mono text-xs break-all whitespace-normal text-muted-foreground">
                          {fila.antes}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'font-mono text-xs break-all whitespace-normal',
                            fila.cambio && 'font-semibold',
                          )}
                        >
                          {fila.despues}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FiltroSelect({
  id,
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string | undefined;
  opciones: [string, string][];
  alCambiar: (v: string | undefined) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {etiqueta}
      </Label>
      <Select value={valor ?? 'todos'} onValueChange={(v) => alCambiar(v === 'todos' ? undefined : v)}>
        <SelectTrigger id={id} className="w-44 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {opciones.map(([v, texto]) => (
            <SelectItem key={v} value={v}>
              {texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
