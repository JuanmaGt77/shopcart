import { ChevronRight, Package } from 'lucide-react';
import { Link } from 'react-router';
import { z } from 'zod';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { formatearFecha, formatearQuetzales } from '@/lib/formato';
import { plural } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { useMisPedidos } from '@/modulos/pedidos/api';
import { InsigniaEstado } from '@/modulos/pedidos/componentes/insignia-estado';
import { ESTADOS_PEDIDO, NOMBRE_ESTADO_PEDIDO } from '@/modulos/pedidos/estados';

const esquemaUrl = z.object({ estado: enUrl.opcion(ESTADOS_PEDIDO), pagina: enUrl.pagina() });

export function PaginaMisPedidos() {
  const { filtros, cambiar } = useFiltrosUrl(esquemaUrl);
  const pedidos = useMisPedidos({ estado: filtros.estado, pagina: filtros.pagina, tamanoPagina: 10 });

  return (
    <section className="space-y-5" aria-labelledby="titulo-pedidos">
      <h1 id="titulo-pedidos" className="text-2xl font-bold tracking-tight">
        Mis pedidos
      </h1>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Filtrar por estado"
      >
        {[undefined, ...ESTADOS_PEDIDO].map((estado) => (
          <Button
            key={estado ?? 'todos'}
            variant={filtros.estado === estado ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            aria-pressed={filtros.estado === estado}
            onClick={() => cambiar({ estado })}
          >
            {estado ? NOMBRE_ESTADO_PEDIDO[estado] : 'Todos'}
          </Button>
        ))}
      </div>

      {pedidos.isError ? (
        <EstadoError error={pedidos.error} alReintentar={() => void pedidos.refetch()} />
      ) : pedidos.data?.datos.length === 0 ? (
        <EstadoVacio
          icono={Package}
          titulo={filtros.estado ? 'No tienes pedidos en este estado' : 'Aún no tienes pedidos'}
          descripcion="Cuando compres, aquí podrás seguir cada pedido en tiempo real."
        >
          <Button asChild>
            <Link to="/productos">Ir a la tienda</Link>
          </Button>
        </EstadoVacio>
      ) : (
        <ul className={cn('space-y-3', pedidos.isFetching && 'opacity-70')}>
          {pedidos.data
            ? pedidos.data.datos.map((p) => (
                <li key={p.idPedido}>
                  <Link
                    to={`/cuenta/pedidos/${p.idPedido}`}
                    className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{p.numeroPedido}</span>
                        <InsigniaEstado estado={p.estadoCodigo} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatearFecha(p.fechaCreacion)} · {plural(p.cantidadArticulos, 'artículo')} ·{' '}
                        {p.metodoEnvioNombre}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatearQuetzales(p.total)}</p>
                      {p.montoDevuelto > 0 && (
                        <p className="text-xs text-exito">
                          -{formatearQuetzales(p.montoDevuelto)} reembolsado
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))
            : Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-20 w-full rounded-xl" />
                </li>
              ))}
        </ul>
      )}

      {pedidos.data && (
        <Paginador
          pagina={pedidos.data.paginacion.pagina}
          totalPaginas={pedidos.data.paginacion.totalPaginas}
          totalRegistros={pedidos.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}
    </section>
  );
}
