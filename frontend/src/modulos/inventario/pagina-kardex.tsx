import { History, X } from 'lucide-react';
import { Link } from 'react-router';
import { z } from 'zod';
import { BarraFiltros, EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { TablaResponsiva, type Columna } from '@/components/compartidos/tabla-responsiva';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { finDelDia, inicioDelDia } from '@/lib/fechas';
import { formatearFechaHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { NOMBRE_MOVIMIENTO, useKardex, type MovimientoKardex, type TipoMovimiento } from './api';

const TIPOS = Object.keys(NOMBRE_MOVIMIENTO) as [TipoMovimiento, ...TipoMovimiento[]];

const esquemaUrl = z.object({
  idVariante: enUrl.entero(),
  sku: enUrl.texto(40),
  tipo: enUrl.opcion(TIPOS),
  desde: enUrl.texto(10),
  hasta: enUrl.texto(10),
  pagina: enUrl.pagina(),
});

const COLUMNAS: Columna<MovimientoKardex>[] = [
  { clave: 'fecha', titulo: 'Fecha', celda: (m) => formatearFechaHora(m.fecha) },
  {
    clave: 'variante',
    titulo: 'Variante',
    celda: (m) => (
      <span className="block max-w-64">
        <span className="block font-mono text-xs">{m.sku}</span>
        <span className="block truncate text-xs text-muted-foreground">{m.nombreProducto}</span>
      </span>
    ),
  },
  {
    clave: 'tipo',
    titulo: 'Movimiento',
    celda: (m) => <Badge variant={m.naturaleza === 'E' ? 'secondary' : 'outline'}>{m.nombreTipo}</Badge>,
  },
  {
    clave: 'cantidad',
    titulo: 'Cantidad',
    derecha: true,
    celda: (m) => (
      <span className={cn('font-semibold', m.cantidad > 0 ? 'text-exito' : 'text-destructive')}>
        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
      </span>
    ),
  },
  {
    clave: 'saldo',
    titulo: 'Saldo',
    derecha: true,
    celda: (m) => `${m.existenciaAnterior} → ${m.existenciaNueva}`,
  },
  {
    clave: 'motivo',
    titulo: 'Motivo',
    soloEscritorio: true,
    celda: (m) =>
      m.idPedido ? (
        <Link
          to={`/panel/pedidos/${m.idPedido}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m.motivo ?? m.numeroPedido}
        </Link>
      ) : (
        <span className="block max-w-64 truncate" title={m.motivo ?? ''}>
          {m.motivo}
        </span>
      ),
  },
  { clave: 'usuario', titulo: 'Usuario', soloEscritorio: true, celda: (m) => m.usuario ?? 'Sistema' },
];

/** El kardex es inmutable: solo se consulta. La existencia de cada variante es la suma de sus movimientos. */
export function PaginaKardex() {
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  const kardex = useKardex({
    idVariante: filtros.idVariante,
    tipo: filtros.tipo,
    desde: rangoInvalido ? undefined : inicioDelDia(filtros.desde),
    hasta: rangoInvalido ? undefined : finDelDia(filtros.hasta),
    pagina: filtros.pagina,
    tamanoPagina: 25,
  });

  return (
    <>
      <EncabezadoPanel descripcion="Cada entrada y salida de inventario con su saldo anterior y nuevo. No se puede modificar ni borrar." />

      <BarraFiltros>
        {filtros.idVariante && (
          <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
            Variante <span className="font-mono font-medium">{filtros.sku ?? `#${filtros.idVariante}`}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar filtro de variante"
              onClick={() => cambiar({ idVariante: undefined, sku: undefined })}
            >
              <X />
            </Button>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-tipo" className="text-xs">
            Tipo
          </Label>
          <Select
            value={filtros.tipo ?? 'todos'}
            onValueChange={(v) => cambiar({ tipo: v === 'todos' ? undefined : v })}
          >
            <SelectTrigger id="filtro-tipo" className="w-56 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {NOMBRE_MOVIMIENTO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kardex-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="kardex-desde"
            type="date"
            className="w-40 bg-background"
            value={filtros.desde ?? ''}
            onChange={(e) => cambiar({ desde: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kardex-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="kardex-hasta"
            type="date"
            className="w-40 bg-background"
            value={filtros.hasta ?? ''}
            onChange={(e) => cambiar({ hasta: e.target.value })}
          />
        </div>
        {(filtros.tipo || filtros.desde || filtros.hasta || filtros.idVariante) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
        {rangoInvalido && (
          <p className="w-full text-xs text-destructive">La fecha inicial no puede ser mayor que la final.</p>
        )}
      </BarraFiltros>

      {kardex.isError ? (
        <EstadoError error={kardex.error} alReintentar={() => void kardex.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Kardex"
          columnas={COLUMNAS}
          filas={kardex.data?.datos}
          claveFila={(m) => m.idKardex}
          cargando={kardex.isFetching}
          vacio={<EstadoVacio icono={History} titulo="No hay movimientos con estos filtros" />}
        />
      )}

      {kardex.data && (
        <Paginador
          className="mt-4"
          pagina={kardex.data.paginacion.pagina}
          totalPaginas={kardex.data.paginacion.totalPaginas}
          totalRegistros={kardex.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}
    </>
  );
}
