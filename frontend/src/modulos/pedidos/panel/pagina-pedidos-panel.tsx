import { ClipboardList, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { BarraFiltros, EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { TablaResponsiva, type Columna } from '@/components/compartidos/tabla-responsiva';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatearFechaHora, formatearQuetzales } from '@/lib/formato';
import { usePedidos } from '../api';
import { InsigniaEstado } from '../componentes/insignia-estado';
import { ESTADOS_PEDIDO, NOMBRE_ESTADO_PEDIDO } from '../estados';
import type { PedidoResumen } from '../tipos';

const esquemaUrl = z.object({
  estado: enUrl.opcion(ESTADOS_PEDIDO),
  cliente: enUrl.texto(),
  desde: enUrl.texto(10),
  hasta: enUrl.texto(10),
  orden: enUrl.opcion(['fecha-desc', 'fecha-asc', 'total-desc', 'total-asc']),
  pagina: enUrl.pagina(),
});

const ORDENES = {
  'fecha-desc': 'Más recientes',
  'fecha-asc': 'Más antiguos',
  'total-desc': 'Mayor total',
  'total-asc': 'Menor total',
} as const;

const COLUMNAS: Columna<PedidoResumen>[] = [
  {
    clave: 'numero',
    titulo: 'Pedido',
    celda: (p) => <span className="font-mono font-medium">{p.numeroPedido}</span>,
  },
  { clave: 'estado', titulo: 'Estado', celda: (p) => <InsigniaEstado estado={p.estadoCodigo} /> },
  {
    clave: 'cliente',
    titulo: 'Cliente',
    celda: (p) => (
      <span className="block max-w-56 truncate" title={p.correoCliente}>
        {p.cliente}
      </span>
    ),
  },
  { clave: 'fecha', titulo: 'Fecha', celda: (p) => formatearFechaHora(p.fechaCreacion) },
  { clave: 'envio', titulo: 'Envío', celda: (p) => p.metodoEnvioNombre, soloEscritorio: true },
  {
    clave: 'articulos',
    titulo: 'Artículos',
    celda: (p) => p.cantidadArticulos,
    derecha: true,
    soloEscritorio: true,
  },
  { clave: 'total', titulo: 'Total', celda: (p) => formatearQuetzales(p.total), derecha: true },
];

export function PaginaPedidosPanel() {
  const navegar = useNavigate();
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const [ordenarPor, direccion] = (filtros.orden ?? 'fecha-desc').split('-') as [
    'fecha' | 'total',
    'asc' | 'desc',
  ];
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);

  const pedidos = usePedidos({
    estado: filtros.estado,
    cliente: filtros.cliente,
    desde: rangoInvalido ? undefined : filtros.desde,
    hasta: rangoInvalido ? undefined : filtros.hasta,
    ordenarPor,
    direccion,
    pagina: filtros.pagina,
    tamanoPagina: 20,
  });
  const hayFiltros = Boolean(filtros.estado || filtros.cliente || filtros.desde || filtros.hasta);

  return (
    <>
      <EncabezadoPanel descripcion="Los pedidos nuevos aparecen solos. Abre uno para prepararlo, despacharlo, cancelarlo o registrar una devolución." />

      <BarraFiltros>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-estado" className="text-xs">
            Estado
          </Label>
          <Select
            value={filtros.estado ?? 'todos'}
            onValueChange={(v) => cambiar({ estado: v === 'todos' ? undefined : v })}
          >
            <SelectTrigger id="filtro-estado" className="w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS_PEDIDO.map((e) => (
                <SelectItem key={e} value={e}>
                  {NOMBRE_ESTADO_PEDIDO[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-cliente" className="text-xs">
            Cliente o número
          </Label>
          <Input
            id="filtro-cliente"
            type="search"
            className="w-56 bg-background"
            placeholder="Nombre, correo o SC-000123"
            defaultValue={filtros.cliente ?? ''}
            key={filtros.cliente ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ cliente: e.currentTarget.value.trim() })}
            onBlur={(e) =>
              e.currentTarget.value.trim() !== (filtros.cliente ?? '') &&
              cambiar({ cliente: e.currentTarget.value.trim() })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="filtro-desde"
            type="date"
            className="w-40 bg-background"
            value={filtros.desde ?? ''}
            onChange={(e) => cambiar({ desde: e.target.value })}
            aria-invalid={rangoInvalido}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="filtro-hasta"
            type="date"
            className="w-40 bg-background"
            value={filtros.hasta ?? ''}
            onChange={(e) => cambiar({ hasta: e.target.value })}
            aria-invalid={rangoInvalido}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-orden" className="text-xs">
            Orden
          </Label>
          <Select
            value={filtros.orden ?? 'fecha-desc'}
            onValueChange={(v) => cambiar({ orden: v === 'fecha-desc' ? undefined : v })}
          >
            <SelectTrigger id="filtro-orden" className="w-40 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDENES).map(([valor, texto]) => (
                <SelectItem key={valor} value={valor}>
                  {texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hayFiltros && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
        {rangoInvalido && (
          <p className="w-full text-xs text-destructive">La fecha inicial no puede ser mayor que la final.</p>
        )}
      </BarraFiltros>

      {pedidos.isError ? (
        <EstadoError error={pedidos.error} alReintentar={() => void pedidos.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Pedidos"
          columnas={COLUMNAS}
          filas={pedidos.data?.datos}
          claveFila={(p) => p.idPedido}
          alAbrir={(p) => navegar(`/panel/pedidos/${p.idPedido}`)}
          cargando={pedidos.isFetching}
          vacio={<EstadoVacio icono={ClipboardList} titulo="No hay pedidos con estos filtros" />}
        />
      )}

      {pedidos.data && (
        <Paginador
          className="mt-4"
          pagina={pedidos.data.paginacion.pagina}
          totalPaginas={pedidos.data.paginacion.totalPaginas}
          totalRegistros={pedidos.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}
    </>
  );
}
