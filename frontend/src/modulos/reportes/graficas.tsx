import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { formatearQuetzales } from '@/lib/formato';
import { plural } from '@/lib/texto';
import type { Agrupacion, PuntoVentas, VentaCategoria } from './api';
import { etiquetaPeriodo, quetzalesCompactos } from './series';

/*
 * Gráficas del dashboard (Recharts dentro del contenedor de shadcn/ui).
 * - Una sola serie por gráfica: sin leyenda (el título dice qué se grafica), color --chart-1
 *   validado en claro y oscuro.
 * - Línea de 2 px con relleno al 10 %, barras de 22 px con punta redondeada de 4 px.
 * - Cuadrícula horizontal tenue, sin eje doble.
 * - Tooltip: el valor primero y en negrita; la etiqueta, después.
 */

const configVentas = {
  montoVendido: { label: 'Ventas netas', color: 'var(--chart-1)' },
} satisfies ChartConfig;
const configCategorias = { monto: { label: 'Ventas', color: 'var(--chart-1)' } } satisfies ChartConfig;

interface ContenidoTooltip<T> {
  active?: boolean;
  payload?: readonly { payload?: T }[];
}

function CajaTooltip({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="flex items-center gap-2 text-base font-semibold tabular-nums">
        <span className="h-0.5 w-3 rounded-full bg-chart-1" aria-hidden />
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}

export function GraficaVentas({ serie, agrupacion }: { serie: PuntoVentas[]; agrupacion: Agrupacion }) {
  return (
    <ChartContainer config={configVentas} className="aspect-auto h-72 w-full">
      <AreaChart data={serie} margin={{ left: 4, right: 12, top: 8, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="periodo"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(v: string) => etiquetaPeriodo(v, agrupacion)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => quetzalesCompactos(v)}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={({ active, payload }: ContenidoTooltip<PuntoVentas>) => {
            const punto = active ? payload?.[0]?.payload : undefined;
            if (!punto) return null;
            return (
              <CajaTooltip
                valor={formatearQuetzales(punto.montoVendido)}
                titulo={etiquetaPeriodo(punto.periodo, agrupacion, true)}
                detalle={`${plural(punto.pedidos, 'pedido')}${punto.pedidos ? ` · ticket ${formatearQuetzales(punto.ticketPromedio)}` : ''}`}
              />
            );
          }}
        />
        <Area
          dataKey="montoVendido"
          type="linear"
          stroke="var(--color-montoVendido)"
          strokeWidth={2}
          fill="var(--color-montoVendido)"
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function GraficaCategorias({ datos }: { datos: VentaCategoria[] }) {
  const ordenados = [...datos].sort((a, b) => b.monto - a.monto);
  return (
    <ChartContainer
      config={configCategorias}
      className="aspect-auto w-full"
      style={{ height: ordenados.length * 38 + 16 }}
    >
      <BarChart
        data={ordenados}
        layout="vertical"
        margin={{ left: 0, right: 64, top: 0, bottom: 0 }}
        accessibilityLayer
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="categoria"
          width={150}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          content={({ active, payload }: ContenidoTooltip<VentaCategoria>) => {
            const fila = active ? payload?.[0]?.payload : undefined;
            if (!fila) return null;
            return (
              <CajaTooltip
                valor={formatearQuetzales(fila.monto)}
                titulo={`${fila.categoria} · ${fila.porcentaje.toLocaleString('es-GT')} % de las ventas`}
                detalle={`${plural(fila.unidades, 'unidad', 'unidades')} en ${plural(fila.pedidos, 'pedido')}`}
              />
            );
          }}
        />
        <Bar
          dataKey="monto"
          fill="var(--color-monto)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="monto"
            position="right"
            className="fill-foreground"
            fontSize={12}
            formatter={(v: unknown) => quetzalesCompactos(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
