import { TicketPercent, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDeError } from '@/lib/errores';
import { formatearQuetzales } from '@/lib/formato';
import { useSesion } from '@/modulos/auth/use-sesion';
import type { Carrito } from '../api';
import { useAplicarCupon, useQuitarCupon } from '../mutaciones';

/**
 * Cupón del carrito. Si no aplica, se muestra el motivo exacto que redacta la API
 * (vencido, agotado, te faltan Q40.00 para el mínimo, solo para cierta categoría...).
 */
export function FormularioCupon({ carrito }: { carrito: Carrito }) {
  const { usuario } = useSesion();
  const [codigo, setCodigo] = useState('');
  const aplicar = useAplicarCupon();
  const quitar = useQuitarCupon();

  if (!usuario) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        <TicketPercent className="size-4 shrink-0" aria-hidden />
        <span>
          ¿Tienes un cupón?{' '}
          <Link to="/login?volver=/carrito" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>{' '}
          para usarlo.
        </span>
      </p>
    );
  }

  if (carrito.cupon) {
    const { cupon } = carrito;
    return (
      <div
        className={
          cupon.aplicado
            ? 'flex items-start gap-2 rounded-lg border border-exito/30 bg-exito/10 px-3 py-2 text-sm'
            : 'flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm'
        }
      >
        <TicketPercent className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-mono font-semibold">{cupon.codigo}</p>
          <p className="text-xs">
            {cupon.aplicado
              ? `Ahorras ${formatearQuetzales(carrito.descuento)}`
              : (cupon.mensaje ?? 'El cupón ya no aplica a tu carrito.')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => quitar.mutate()}
          disabled={quitar.isPending}
          aria-label="Quitar cupón"
        >
          <X />
        </Button>
      </div>
    );
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (limpio) aplicar.mutate(limpio, { onSuccess: () => setCodigo('') });
  };

  return (
    <form onSubmit={enviar} className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            if (aplicar.isError) aplicar.reset();
          }}
          placeholder="Código de cupón"
          aria-label="Código de cupón"
          aria-invalid={aplicar.isError}
          aria-describedby="error-cupon"
          className="h-9 font-mono uppercase placeholder:font-sans placeholder:normal-case"
          maxLength={30}
          autoCapitalize="characters"
        />
        <Button type="submit" variant="outline" size="lg" disabled={!codigo.trim() || aplicar.isPending}>
          {aplicar.isPending && <Spinner />} Aplicar
        </Button>
      </div>
      <p id="error-cupon" className="text-xs text-destructive" aria-live="polite">
        {aplicar.isError ? mensajeDeError(aplicar.error) : ''}
      </p>
    </form>
  );
}
