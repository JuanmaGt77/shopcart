import { AlertTriangle, ArrowRight, Ban, Download, ShoppingCart, Undo2, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { EstadoError } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { haceDias, hoyGuatemala } from '@/lib/fechas';
import { formatearFecha, formatearFechaHora, formatearQuetzales } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { InsigniaEstado } from '@/modulos/pedidos/componentes/insignia-estado';
import {
  useCarritosAbandonados,
  useResumen,
  useTopProductos,
  useVentas,
  useVentasPorCategoria,
  type Agrupacion,
  type Rango,
} from './api';
import { exportarCategorias, exportarTopProductos, exportarVentas } from './exportar';
import { GraficaCategorias, GraficaVentas } from './graficas';
import { completarDias, etiquetaPeriodo } from './series';

const PRESETS = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días' } as const;

const esquemaUrl = z.object({
  rango: enUrl.opcion(['7', '30', '90', 'personalizado']),
  desde: enUrl.texto(10),
  hasta: enUrl.texto(10),
  agrupacion: enUrl.opcion(['dia', 'semana', 'mes']),
  paginaCarritos: enUrl.pagina(),
});

/** Rango elegido: un preset (por defecto 30 días) o fechas propias. Todo el tablero usa el mismo rango. */
function calcularRango(filtros: z.output<typeof esquemaUrl>): Rango {
  if (filtros.rango === 'personalizado' && filtros.desde && filtros.hasta && filtros.desde <= filtros.hasta) {
    return { desde: filtros.desde, hasta: filtros.hasta };
  }
  const dias = Number(filtros.rango && filtros.rango !== 'personalizado' ? filtros.rango : 30);
  return { desde: haceDias(dias - 1), hasta: hoyGuatemala() };
}

export function PaginaDashboard() {
  const { filtros, cambiar } = useFiltrosUrl(esquemaUrl);
  const rango = calcularRango(filtros);
  const agrupacion: Agrupacion = filtros.agrupacion ?? 'dia';
  const preset = filtros.rango ?? '30';

  const resumen = useResumen(rango);
  const ventas = useVentas(rango, agrupacion);
  const categorias = useVentasPorCategoria(rango);
  const top = useTopProductos(rango);

  const serie = ventas.data
    ? agrupacion === 'dia'
      ? completarDias(ventas.data, rango.desde, rango.hasta)
      : ventas.data
    : undefined;

  return (
    <div className="space-y-6">
      {/* Filtros: una sola fila arriba; afectan a todo el tablero */}
      <div className="flex flex-wrap items-end gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={preset}
          onValueChange={(v) =>
            v && cambiar({ rango: v === '30' ? undefined : v, paginaCarritos: undefined })
          }
          aria-label="Rango de fechas"
        >
          {Object.entries(PRESETS).map(([valor, texto]) => (
            <ToggleGroupItem key={valor} value={valor} className="px-3">
              {texto}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value="personalizado" className="px-3">
            Personalizado
          </ToggleGroupItem>
        </ToggleGroup>
        {preset === 'personalizado' && (
          <>
            <div className="grid gap-1">
              <Label htmlFor="dash-desde" className="text-xs">
                Desde
              </Label>
              <Input
                id="dash-desde"
                type="date"
                className="w-40"
                max={filtros.hasta ?? hoyGuatemala()}
                value={filtros.desde ?? rango.desde}
                onChange={(e) =>
                  cambiar({
                    rango: 'personalizado',
                    desde: e.target.value,
                    hasta: filtros.hasta ?? rango.hasta,
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="dash-hasta" className="text-xs">
                Hasta
              </Label>
              <Input
                id="dash-hasta"
                type="date"
                className="w-40"
                min={filtros.desde}
                max={hoyGuatemala()}
                value={filtros.hasta ?? rango.hasta}
                onChange={(e) =>
                  cambiar({
                    rango: 'personalizado',
                    hasta: e.target.value,
                    desde: filtros.desde ?? rango.desde,
                  })
                }
              />
            </div>
          </>
        )}
        {resumen.dataUpdatedAt > 0 && (
          <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            Se actualiza solo con cada venta · {formatearFechaHora(new Date(resumen.dataUpdatedAt))}
          </p>
        )}
      </div>

      {resumen.isError ? (
        <EstadoError error={resumen.error} alReintentar={() => void resumen.refetch()} />
      ) : (
        <section
          aria-label="Indicadores"
          className={cn('grid gap-4 lg:grid-cols-[1.2fr_2fr]', resumen.isFetching && 'opacity-70')}
        >
          <Card className="justify-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">Ventas netas</p>
              {resumen.data ? (
                <p className="text-5xl font-semibold tracking-tight">
                  {formatearQuetzales(resumen.data.ventasNetas)}
                </p>
              ) : (
                <Skeleton className="mt-1 h-12 w-56" />
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {formatearFecha(`${rango.desde}T12:00:00Z`)} – {formatearFecha(`${rango.hasta}T12:00:00Z`)} ·
                sin cancelados y restando devoluciones
              </p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Tile etiqueta="Pedidos" valor={resumen.data?.pedidos.toLocaleString('es-GT')} />
            <Tile
              etiqueta="Ticket promedio"
              valor={resumen.data && formatearQuetzales(resumen.data.ticketPromedio)}
            />
            <Tile
              etiqueta="Unidades vendidas"
              valor={resumen.data?.unidadesVendidas.toLocaleString('es-GT')}
            />
            <Tile
              etiqueta="Devuelto"
              icono={<Undo2 className="size-4" aria-hidden />}
              valor={resumen.data && formatearQuetzales(resumen.data.montoDevuelto)}
            />
            <Tile
              etiqueta="Cancelados"
              icono={<Ban className="size-4" aria-hidden />}
              valor={resumen.data?.pedidosCancelados.toLocaleString('es-GT')}
            />
            <Tile
              etiqueta="Clientes nuevos"
              icono={<UserPlus className="size-4" aria-hidden />}
              valor={resumen.data?.clientesNuevos.toLocaleString('es-GT')}
            />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Ventas netas en el tiempo</CardTitle>
              <CardDescription>Por {agrupacion === 'dia' ? 'día' : agrupacion}, en quetzales</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={agrupacion}
                onValueChange={(v) => v && cambiar({ agrupacion: v === 'dia' ? undefined : v })}
                aria-label="Agrupar por"
              >
                <ToggleGroupItem value="dia">Día</ToggleGroupItem>
                <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
                <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
              </ToggleGroup>
              <BotonExportar
                deshabilitado={!serie?.length}
                alExportar={() => serie && exportarVentas(serie, agrupacion, rango)}
              />
            </div>
          </CardHeader>
          <CardContent className={cn(ventas.isFetching && 'opacity-60')}>
            {ventas.isError ? (
              <EstadoError error={ventas.error} alReintentar={() => void ventas.refetch()} />
            ) : !serie ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <Tabs defaultValue="grafica">
                <TabsList className="mb-3">
                  <TabsTrigger value="grafica">Gráfica</TabsTrigger>
                  <TabsTrigger value="tabla">Tabla</TabsTrigger>
                </TabsList>
                <TabsContent value="grafica">
                  <GraficaVentas serie={serie} agrupacion={agrupacion} />
                </TabsContent>
                <TabsContent value="tabla" className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Periodo</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Ticket</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...serie].reverse().map((p) => (
                        <TableRow key={p.periodo}>
                          <TableCell>{etiquetaPeriodo(p.periodo, agrupacion, true)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.pedidos}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatearQuetzales(p.ticketPromedio)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatearQuetzales(p.montoVendido)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos por estado</CardTitle>
            <CardDescription>Del rango elegido</CardDescription>
          </CardHeader>
          <CardContent>
            {resumen.data ? (
              <ListaConBarras
                filas={resumen.data.pedidosPorEstado.map((e) => ({
                  clave: e.codigo,
                  etiqueta: <InsigniaEstado estado={e.codigo} />,
                  valor: e.pedidos,
                  texto: e.pedidos.toLocaleString('es-GT'),
                }))}
              />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Ventas por categoría</CardTitle>
              <CardDescription>Monto vendido neto de devoluciones</CardDescription>
            </div>
            <BotonExportar
              deshabilitado={!categorias.data?.length}
              alExportar={() => categorias.data && exportarCategorias(categorias.data, rango)}
            />
          </CardHeader>
          <CardContent className={cn(categorias.isFetching && 'opacity-60')}>
            {categorias.isError ? (
              <EstadoError error={categorias.error} alReintentar={() => void categorias.refetch()} />
            ) : categorias.data ? (
              categorias.data.length ? (
                <GraficaCategorias datos={categorias.data} />
              ) : (
                <SinDatos />
              )
            ) : (
              <Skeleton className="h-72 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Top 10 productos</CardTitle>
              <CardDescription>Por unidades vendidas (netas de devoluciones)</CardDescription>
            </div>
            <BotonExportar
              deshabilitado={!top.data?.length}
              alExportar={() => top.data && exportarTopProductos(top.data, rango)}
            />
          </CardHeader>
          <CardContent className={cn(top.isFetching && 'opacity-60')}>
            {top.isError ? (
              <EstadoError error={top.error} alReintentar={() => void top.refetch()} />
            ) : top.data ? (
              top.data.length ? (
                <ListaConBarras
                  filas={top.data.map((p) => ({
                    clave: String(p.idProducto),
                    etiqueta: (
                      <span className="min-w-0">
                        <span className="mr-2 text-muted-foreground tabular-nums">{p.posicion}.</span>
                        <span className="font-medium">{p.producto}</span>
                        <span className="block pl-5 text-xs text-muted-foreground">
                          {p.categoria} · {formatearQuetzales(p.monto)}
                        </span>
                      </span>
                    ),
                    valor: p.unidades,
                    texto: `${p.unidades} u.`,
                  }))}
                />
              ) : (
                <SinDatos />
              )
            ) : (
              <Skeleton className="h-72 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <CarritosAbandonados
        pagina={filtros.paginaCarritos}
        alCambiarPagina={(p) => cambiar({ paginaCarritos: p, pagina: undefined })}
        bajoStock={resumen.data?.variantesBajoStock}
      />
    </div>
  );
}

function Tile({
  etiqueta,
  valor,
  icono,
}: {
  etiqueta: string;
  valor: string | undefined;
  icono?: ReactNode;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icono}
          {etiqueta}
        </p>
        {valor === undefined ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{valor}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Lista con barra de magnitud (un solo tono): para rankings y conteos donde una gráfica sería ruido. */
function ListaConBarras({
  filas,
}: {
  filas: { clave: string; etiqueta: ReactNode; valor: number; texto: string }[];
}) {
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.clave} className="space-y-1">
          <div className="flex items-start justify-between gap-3 text-sm">
            {f.etiqueta}
            <span className="shrink-0 font-medium tabular-nums">{f.texto}</span>
          </div>
          <div className="h-1.5 rounded-full bg-chart-1/15" aria-hidden>
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${(f.valor / maximo) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SinDatos() {
  return <p className="py-10 text-center text-sm text-muted-foreground">No hay ventas en este rango.</p>;
}

function CarritosAbandonados({
  pagina,
  alCambiarPagina,
  bajoStock,
}: {
  pagina: number;
  alCambiarPagina: (pagina: number) => void;
  bajoStock: number | undefined;
}) {
  const carritos = useCarritosAbandonados(pagina);
  const total = carritos.data?.datos[0]?.valorTotalAbandonado;
  const horas = carritos.data?.datos[0]?.horasConfiguradas;

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" aria-hidden /> Carritos abandonados
          </CardTitle>
          <CardDescription>
            Sin actividad por más de {horas ?? 24} horas
            {total !== undefined && ` · valor total ${formatearQuetzales(total)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(carritos.isFetching && 'opacity-60')}>
          {carritos.isError ? (
            <EstadoError error={carritos.error} alReintentar={() => void carritos.refetch()} />
          ) : !carritos.data ? (
            <Skeleton className="h-48 w-full" />
          ) : carritos.data.datos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay carritos abandonados.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Artículos</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Inactivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carritos.data.datos.map((c) => (
                    <TableRow key={c.idCarrito}>
                      <TableCell>
                        <span className="block font-medium">{c.cliente}</span>
                        {c.correo && <span className="block text-xs text-muted-foreground">{c.correo}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.cantidadArticulos}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {c.horasInactivo} h
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearQuetzales(c.valorEstimado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Paginador
                className="mt-3"
                pagina={carritos.data.paginacion.pagina}
                totalPaginas={carritos.data.paginacion.totalPaginas}
                alCambiar={alCambiarPagina}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit justify-between">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-advertencia" aria-hidden /> Existencia baja
          </CardTitle>
          <CardDescription>Variantes en o por debajo del umbral configurado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bajoStock === undefined ? (
            <Skeleton className="h-12 w-20" />
          ) : (
            <p className="text-4xl font-semibold">{bajoStock}</p>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to="/panel/inventario?bajoStock=true">
              Ver en inventario <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BotonExportar({ alExportar, deshabilitado }: { alExportar: () => void; deshabilitado: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={alExportar} disabled={deshabilitado}>
      <Download /> Exportar CSV
    </Button>
  );
}
