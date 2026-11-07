import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShoppingBag, TimerOff } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { PREFIJO } from '@/api/claves';
import { EstadoError, EstadoVacio, PantallaCarga } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSesion } from '@/modulos/auth/use-sesion';
import { useCarrito } from '@/modulos/carrito/consultas';
import { apiCheckout, type Checkout } from '../api';
import { PasoEntrega } from '../componentes/paso-entrega';
import { PasoPago } from '../componentes/paso-pago';
import { useSegundosRestantes } from '../tiempo-reserva';

const PASOS = ['Entrega', 'Pago', 'Confirmación'];

/**
 * Checkout en dos pasos:
 *   1. Entrega: dirección y envío. Al confirmar, la API aparta las unidades 15 min (checkout ACTIVO).
 *   2. Pago: con el checkout en la URL (?checkout=ID) para que recargar la página no lo pierda.
 * Si el carrito ya tenía un checkout activo, se continúa con ese.
 */
export function PaginaCheckout() {
  const { usuario } = useSesion();
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const carrito = useCarrito();

  const idCheckout = Number(parametros.get('checkout')) || carrito.data?.checkoutActivo?.idCheckout || null;
  const checkout = useQuery({
    queryKey: [PREFIJO.checkout, usuario?.idUsuario, idCheckout],
    queryFn: ({ signal }) => apiCheckout.obtener(idCheckout ?? 0, signal),
    enabled: idCheckout !== null,
  });

  // El límite sale de los segundos que reportó el servidor contados desde que llegó la respuesta,
  // así no importa si el reloj de la computadora del cliente está adelantado o atrasado
  const recibido = checkout.dataUpdatedAt;
  const segundosServidor = checkout.data?.segundosRestantes ?? 0;
  const limite = useMemo(() => recibido + segundosServidor * 1000, [recibido, segundosServidor]);
  const segundos = useSegundosRestantes(limite);
  const activo = checkout.data?.estado === 'ACTIVO';

  // Al llegar a cero se confirma con el servidor (el job libera la reserva)
  const { refetch } = checkout;
  useEffect(() => {
    if (activo && segundos === 0) void refetch();
  }, [activo, segundos, refetch]);

  const alIniciar = (nuevo: Checkout) => {
    cliente.setQueryData([PREFIJO.checkout, usuario?.idUsuario, nuevo.idCheckout], nuevo);
    setParametros({ checkout: String(nuevo.idCheckout) }, { replace: true });
  };

  const volverAEntrega = () => {
    void cliente.removeQueries({ queryKey: [PREFIJO.checkout] });
    setParametros({}, { replace: true });
  };

  let contenido;
  let paso = 0;
  if (carrito.isPending || (idCheckout && checkout.isPending)) {
    contenido = <PantallaCarga />;
  } else if (carrito.isError) {
    contenido = <EstadoError error={carrito.error} alReintentar={() => void carrito.refetch()} />;
  } else if (idCheckout && checkout.isError) {
    contenido = <EstadoError error={checkout.error} alReintentar={volverAEntrega} />;
  } else if (checkout.data?.estado === 'COMPLETADO' && checkout.data.idPedido) {
    return <Navigate to={`/cuenta/pedidos/${checkout.data.idPedido}`} replace />;
  } else if (checkout.data && activo && segundos > 0) {
    paso = 1;
    contenido = (
      <PasoPago
        checkout={checkout.data}
        segundos={segundos}
        alCambiarEntrega={volverAEntrega}
        alPagar={(idPedido) => navegar(`/cuenta/pedidos/${idPedido}?nuevo=1`, { replace: true })}
      />
    );
  } else if (checkout.data) {
    contenido = (
      <EstadoVacio
        icono={TimerOff}
        titulo="Tu reserva venció"
        descripcion="Pasaron los 15 minutos y liberamos las unidades para otros clientes. Tus productos siguen en el carrito."
      >
        <Button onClick={volverAEntrega}>Volver a intentar</Button>
      </EstadoVacio>
    );
  } else if (!carrito.data || carrito.data.lineas.length === 0) {
    contenido = (
      <EstadoVacio
        icono={ShoppingBag}
        titulo="Tu carrito está vacío"
        descripcion="Agrega productos para poder pagar."
      >
        <Button asChild>
          <Link to="/productos">Ver productos</Link>
        </Button>
      </EstadoVacio>
    );
  } else {
    contenido = <PasoEntrega carrito={carrito.data} alIniciar={alIniciar} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Finalizar compra</h1>
        <ol className="flex items-center gap-2 text-sm" aria-label="Pasos">
          {PASOS.map((nombre, i) => (
            <li
              key={nombre}
              className="flex items-center gap-2"
              aria-current={i === paso ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-xs font-semibold',
                  i < paso && 'border-primary bg-primary text-primary-foreground',
                  i === paso && 'border-primary text-primary',
                  i > paso && 'text-muted-foreground',
                )}
              >
                {i < paso ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn(i === paso ? 'font-medium' : 'text-muted-foreground', 'hidden sm:inline')}>
                {nombre}
              </span>
              {i < PASOS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>
      {contenido}
    </div>
  );
}
