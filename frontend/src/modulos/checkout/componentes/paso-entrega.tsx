import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Lock, MapPin, Pencil, Plus, Store, Truck, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PREFIJO } from '@/api/claves';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { esErrorApi, mensajeDeError } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Carrito } from '@/modulos/carrito/api';
import { ResumenMontos } from '@/modulos/carrito/componentes/resumen-carrito';
import { textoDireccion, useDirecciones, type Direccion } from '@/modulos/direcciones/api';
import { DialogoDireccion } from '@/modulos/direcciones/componentes/dialogo-direccion';
import { textoDias, useMetodosEnvio } from '@/modulos/sistema/catalogos';
import { apiCheckout, type Checkout } from '../api';
import { ResumenLineas } from './resumen-lineas';

const ICONO_ENVIO = { TIENDA: Store, ESTANDAR: Truck, EXPRESS: Zap } as Record<string, typeof Truck>;

/** Paso 1: dónde se entrega y cómo. Al confirmar, la API aparta las unidades y congela los precios. */
export function PasoEntrega({
  carrito,
  alIniciar,
}: {
  carrito: Carrito;
  alIniciar: (checkout: Checkout) => void;
}) {
  const cliente = useQueryClient();
  const direcciones = useDirecciones();
  const metodos = useMetodosEnvio();
  const [idDireccionElegida, setIdDireccion] = useState<number | null>(null);
  const [idMetodoElegido, setIdMetodo] = useState<number | null>(null);
  const [dialogo, setDialogo] = useState<{ abierto: boolean; direccion?: Direccion }>({ abierto: false });

  // Por defecto: la dirección predeterminada y el envío estándar
  const idDireccion =
    idDireccionElegida ??
    direcciones.data?.find((d) => d.esPredeterminada)?.idDireccion ??
    direcciones.data?.[0]?.idDireccion ??
    null;
  const idMetodo =
    idMetodoElegido ?? metodos.data?.find((m) => m.codigo === 'ESTANDAR')?.idMetodoEnvio ?? null;
  const metodo = metodos.data?.find((m) => m.idMetodoEnvio === idMetodo);

  const iniciar = useMutation({
    mutationFn: () => apiCheckout.iniciar(idDireccion ?? 0, idMetodo ?? 0),
    onSuccess: (checkout) => {
      void cliente.invalidateQueries({ queryKey: [PREFIJO.carrito] });
      alIniciar(checkout);
    },
    onError: (error) => {
      // Si alguien se llevó las últimas unidades, el carrito cambió: se vuelve a pedir para mostrarlo
      if (esErrorApi(error, 'STOCK_INSUFICIENTE', 'PRODUCTO_NO_DISPONIBLE', 'CARRITO_VACIO')) {
        void cliente.invalidateQueries({ queryKey: [PREFIJO.carrito] });
      }
      toast.error(mensajeDeError(error));
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section aria-labelledby="titulo-direccion" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-direccion" className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="size-5 text-primary" aria-hidden /> Dirección
            </h2>
            <Button variant="outline" size="sm" onClick={() => setDialogo({ abierto: true })}>
              <Plus /> Nueva
            </Button>
          </div>
          {direcciones.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : direcciones.data?.length === 0 ? (
            <button
              type="button"
              onClick={() => setDialogo({ abierto: true })}
              className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-5" aria-hidden />
              Agrega una dirección para continuar
            </button>
          ) : (
            <RadioGroup
              value={idDireccion?.toString() ?? ''}
              onValueChange={(v) => setIdDireccion(Number(v))}
              aria-labelledby="titulo-direccion"
              className="gap-2"
            >
              {direcciones.data?.map((d) => (
                <Label
                  key={d.idDireccion}
                  htmlFor={`direccion-${d.idDireccion}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal hover:bg-muted/40',
                    idDireccion === d.idDireccion && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <RadioGroupItem
                    value={String(d.idDireccion)}
                    id={`direccion-${d.idDireccion}`}
                    className="mt-0.5"
                  />
                  <span className="flex-1 space-y-0.5">
                    <span className="block font-medium">
                      {d.alias}
                      {d.esPredeterminada && (
                        <span className="ml-2 text-xs text-muted-foreground">(predeterminada)</span>
                      )}
                    </span>
                    <span className="block text-sm text-muted-foreground">{textoDireccion(d)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {d.nombreDestinatario} · {d.telefono}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${d.alias}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setDialogo({ abierto: true, direccion: d });
                    }}
                  >
                    <Pencil />
                  </Button>
                </Label>
              ))}
            </RadioGroup>
          )}
        </section>

        <section aria-labelledby="titulo-envio" className="space-y-3">
          <h2 id="titulo-envio" className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="size-5 text-primary" aria-hidden /> Envío
          </h2>
          {metodos.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <RadioGroup
              value={idMetodo?.toString() ?? ''}
              onValueChange={(v) => setIdMetodo(Number(v))}
              aria-labelledby="titulo-envio"
              className="gap-2 sm:grid-cols-3"
            >
              {metodos.data?.map((m) => {
                const Icono = ICONO_ENVIO[m.codigo] ?? Truck;
                return (
                  <Label
                    key={m.idMetodoEnvio}
                    htmlFor={`envio-${m.idMetodoEnvio}`}
                    className={cn(
                      'flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-4 font-normal hover:bg-muted/40',
                      idMetodo === m.idMetodoEnvio && 'border-primary bg-primary/5 ring-1 ring-primary',
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <Icono className="size-5 text-primary" aria-hidden />
                      <RadioGroupItem value={String(m.idMetodoEnvio)} id={`envio-${m.idMetodoEnvio}`} />
                    </span>
                    <span className="font-medium">{m.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.descripcion} Listo en {textoDias(m.diasEstimadosMin, m.diasEstimadosMax)}.
                    </span>
                    <span className="font-semibold">
                      {m.costo === 0 ? 'Gratis' : formatearQuetzales(m.costo)}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          )}
          {metodo?.codigo === 'TIENDA' && (
            <p className="text-xs text-muted-foreground">
              Te avisamos cuando esté listo. Usamos la dirección elegida como dato de contacto.
            </p>
          )}
        </section>
      </div>

      <aside
        className="h-fit space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-36"
        aria-label="Resumen"
      >
        <h2 className="font-semibold">Tu pedido</h2>
        <ResumenLineas lineas={carrito.lineas} />
        <ResumenMontos
          filas={[
            { etiqueta: 'Subtotal', monto: carrito.subtotal },
            {
              etiqueta: 'Descuento',
              monto: carrito.descuento,
              descuento: true,
              nota: carrito.cupon?.aplicado ? carrito.cupon.codigo : undefined,
            },
          ]}
          total={carrito.total}
        />
        <p className="text-xs text-muted-foreground">
          {metodo ? `Envío: ${metodo.costo === 0 ? 'gratis' : formatearQuetzales(metodo.costo)}. ` : ''}
          El total con envío lo calcula la tienda al apartar tus productos.
        </p>
        {carrito.tieneProblemas && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>
              Algunos productos ya no tienen suficientes unidades.{' '}
              <Link to="/carrito" className="font-medium underline">
                Revisa tu carrito
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Button
          size="xl"
          className="w-full"
          disabled={!idDireccion || !idMetodo || carrito.tieneProblemas || iniciar.isPending}
          onClick={() => iniciar.mutate()}
        >
          {iniciar.isPending ? <Spinner /> : <Lock />} Apartar y continuar al pago
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Apartamos tus productos 15 minutos y congelamos los precios mientras pagas.
        </p>
      </aside>

      <DialogoDireccion
        abierto={dialogo.abierto}
        direccion={dialogo.direccion}
        alCambiarAbierto={(abierto) => setDialogo((d) => ({ ...d, abierto }))}
        alGuardar={(guardada) => setIdDireccion(guardada.idDireccion)}
      />
    </div>
  );
}
