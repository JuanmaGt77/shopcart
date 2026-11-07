import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, CreditCard, Lock, MapPin, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PREFIJO } from '@/api/claves';
import { CampoTexto } from '@/components/formulario/campo-texto';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { esErrorApi, mensajeDeError } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { ResumenMontos } from '@/modulos/carrito/componentes/resumen-carrito';
import { textoDias } from '@/modulos/sistema/catalogos';
import { apiCheckout, type Checkout } from '../api';
import { intentoTerminado, nuevaClaveIdempotencia } from '../idempotencia';
import {
  expiracionVigente,
  formatearExpiracion,
  formatearNumeroTarjeta,
  luhnValido,
  marcaTarjeta,
  TARJETAS_DE_PRUEBA,
} from '../tarjeta';
import { CuentaRegresiva } from './cuenta-regresiva';
import { ResumenLineas } from './resumen-lineas';

const esquema = z.object({
  numero: z.string().refine(luhnValido, 'Revisa el número de la tarjeta'),
  titular: z.string().trim().min(3, 'Escribe el nombre como aparece en la tarjeta').max(100),
  expiracion: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Usa el formato MM/AA')
    .refine((v) => expiracionVigente(v), 'La tarjeta está vencida'),
  cvv: z.string().regex(/^\d{3,4}$/, 'El CVV tiene 3 o 4 dígitos'),
});
type Formulario = z.infer<typeof esquema>;

interface PasoPagoProps {
  checkout: Checkout;
  segundos: number;
  alPagar: (idPedido: number) => void;
  alCambiarEntrega: () => void;
}

/** Paso 2: resumen congelado por la API, cuenta regresiva de la reserva y pago con tarjeta. */
export function PasoPago({ checkout, segundos, alPagar, alCambiarEntrega }: PasoPagoProps) {
  const cliente = useQueryClient();
  // Una clave por intento de pago; se reusa en los reintentos del mismo intento
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { numero: '', titular: '', expiracion: '', cvv: '' },
  });

  const pagar = useMutation({
    mutationFn: (datos: Formulario) =>
      apiCheckout.pagar(
        checkout.idCheckout,
        { ...datos, numero: datos.numero.replace(/\s/g, '') },
        claveIdempotencia,
      ),
    onSuccess: ({ pedido }) => {
      void cliente.invalidateQueries({ queryKey: [PREFIJO.carrito] });
      void cliente.invalidateQueries({ queryKey: [PREFIJO.pedidos] });
      alPagar(pedido.idPedido);
    },
    onError: (error) => {
      if (intentoTerminado(error)) setClaveIdempotencia(nuevaClaveIdempotencia());
      if (esErrorApi(error, 'RESERVA_EXPIRADA', 'CHECKOUT_NO_ACTIVO')) {
        void cliente.invalidateQueries({ queryKey: [PREFIJO.checkout] });
      }
    },
  });

  const cambiarEntrega = useMutation({
    mutationFn: () => apiCheckout.cancelar(checkout.idCheckout),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: [PREFIJO.carrito] });
      alCambiarEntrega();
    },
  });

  const marca = marcaTarjeta(useWatch({ control: formulario.control, name: 'numero' }));
  const ocupado = pagar.isPending || cambiarEntrega.isPending;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <CuentaRegresiva segundos={segundos} />

        <section aria-labelledby="titulo-entrega" className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-entrega" className="font-semibold">
              Entrega
            </h2>
            <Button variant="link" size="sm" onClick={() => cambiarEntrega.mutate()} disabled={ocupado}>
              <ArrowLeft /> Cambiar
            </Button>
          </div>
          <p className="flex items-start gap-2 text-sm">
            {checkout.costoEnvio === 0 ? (
              <Store className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            )}
            <span>
              <span className="font-medium">{checkout.metodoEnvio}</span> · listo en{' '}
              {textoDias(checkout.diasEstimadosMin, checkout.diasEstimadosMax)}
            </span>
          </p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium text-foreground">{checkout.destinatario}</span> ·{' '}
              {checkout.direccionTexto}
            </span>
          </p>
        </section>

        <section aria-labelledby="titulo-pago" className="space-y-4 rounded-xl border p-4">
          <h2 id="titulo-pago" className="flex items-center gap-2 font-semibold">
            <CreditCard className="size-5 text-primary" aria-hidden /> Tarjeta de crédito o débito
          </h2>

          <form
            id="formulario-pago"
            onSubmit={formulario.handleSubmit((datos) => pagar.mutate(datos))}
            noValidate
          >
            <FieldGroup className="gap-4">
              <Controller
                control={formulario.control}
                name="numero"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="numero-tarjeta">
                      Número de tarjeta {marca && <span className="text-muted-foreground">· {marca}</span>}
                    </FieldLabel>
                    <Input
                      id="numero-tarjeta"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 5678 9012 3456"
                      className="font-mono"
                      {...field}
                      onChange={(e) => field.onChange(formatearNumeroTarjeta(e.target.value))}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <CampoTexto
                control={formulario.control}
                name="titular"
                etiqueta="Nombre en la tarjeta"
                autoComplete="cc-name"
              />
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  control={formulario.control}
                  name="expiracion"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="expiracion">Vence (MM/AA)</FieldLabel>
                      <Input
                        id="expiracion"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="12/28"
                        className="font-mono"
                        {...field}
                        onChange={(e) => field.onChange(formatearExpiracion(e.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <CampoTexto
                  control={formulario.control}
                  name="cvv"
                  etiqueta="CVV"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  className="font-mono"
                />
              </div>
            </FieldGroup>
          </form>

          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Pago simulado. Prueba con estas tarjetas (cualquier fecha futura y CVV de 3 dígitos):
            </p>
            <div className="flex flex-wrap gap-2">
              {TARJETAS_DE_PRUEBA.map((t) => (
                <Button
                  key={t.numero}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    formulario.reset({
                      numero: t.numero,
                      titular: 'Cliente de prueba',
                      expiracion: '12/30',
                      cvv: '123',
                    })
                  }
                >
                  {t.etiqueta}
                </Button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside
        className="h-fit space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-36"
        aria-label="Resumen"
      >
        <h2 className="font-semibold">Resumen</h2>
        <ResumenLineas lineas={checkout.lineas} />
        <ResumenMontos
          filas={[
            { etiqueta: 'Subtotal', monto: checkout.subtotal },
            {
              etiqueta: 'Descuento',
              monto: checkout.descuento,
              descuento: true,
              ...(checkout.codigoCupon ? { nota: checkout.codigoCupon } : {}),
            },
            { etiqueta: 'Envío', monto: checkout.costoEnvio },
          ]}
          total={checkout.total}
        />
        <Separator />
        <p className="text-xs text-muted-foreground">
          Incluye IVA de {formatearQuetzales(checkout.montoIVA)} (base{' '}
          {formatearQuetzales(checkout.baseImponible)}).
        </p>

        {pagar.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>
              {esErrorApi(pagar.error, 'PAGO_RECHAZADO') ? 'Pago rechazado' : 'No se pudo pagar'}
            </AlertTitle>
            <AlertDescription>{mensajeDeError(pagar.error)}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          form="formulario-pago"
          size="xl"
          variant="promo"
          className="w-full"
          disabled={ocupado || segundos === 0}
        >
          {pagar.isPending ? <Spinner /> : <Lock />}
          {pagar.isPending ? 'Procesando pago…' : `Pagar ${formatearQuetzales(checkout.total)}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Aunque des dos clics o se corte la conexión, solo se crea un pedido y un cobro.
        </p>
      </aside>
    </div>
  );
}
