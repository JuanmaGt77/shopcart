import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pedir } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, PantallaCarga } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDeError } from '@/lib/errores';
import { formatearFechaHora } from '@/lib/formato';

interface Parametro {
  clave: string;
  valor: number;
  valorMinimo: number;
  valorMaximo: number;
  descripcion: string;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}

const TITULOS: Record<string, { titulo: string; unidad: string }> = {
  SEGUNDOS_RESERVA_CHECKOUT: { titulo: 'Duración de la reserva al pagar', unidad: 'segundos' },
  HORAS_CARRITO_ABANDONADO: { titulo: 'Carrito abandonado después de', unidad: 'horas' },
  UMBRAL_STOCK_BAJO: { titulo: 'Existencia baja desde', unidad: 'unidades' },
};

export function PaginaParametros() {
  const parametros = useQuery({
    queryKey: [PREFIJO.sistema, 'parametros'],
    queryFn: ({ signal }) => pedir<Parametro[]>('/parametros', { senal: signal }),
  });

  if (parametros.isPending) return <PantallaCarga />;
  if (parametros.isError)
    return <EstadoError error={parametros.error} alReintentar={() => void parametros.refetch()} />;

  return (
    <>
      <EncabezadoPanel descripcion="Valores que el sistema lee en cada operación. Cada cambio queda en la bitácora con el valor anterior y el nuevo." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {parametros.data.map((p) => (
          <TarjetaParametro key={`${p.clave}-${p.valor}`} parametro={p} />
        ))}
      </div>
    </>
  );
}

function TarjetaParametro({ parametro }: { parametro: Parametro }) {
  const cliente = useQueryClient();
  const [valor, setValor] = useState(String(parametro.valor));
  const numero = Number(valor);
  const enRango =
    Number.isInteger(numero) && numero >= parametro.valorMinimo && numero <= parametro.valorMaximo;
  const info = TITULOS[parametro.clave] ?? { titulo: parametro.clave, unidad: '' };
  const id = `parametro-${parametro.clave}`;

  const guardar = useMutation({
    mutationFn: () =>
      pedir<Parametro>(`/parametros/${parametro.clave}`, { metodo: 'PUT', cuerpo: { valor: numero } }),
    onSuccess: () => {
      toast.success(`${info.titulo}: ${numero} ${info.unidad}`);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.sistema, 'parametros'] });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{info.titulo}</CardTitle>
        <CardDescription>{parametro.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor={id} className="text-xs">
            {info.unidad} (entre {parametro.valorMinimo} y {parametro.valorMaximo})
          </Label>
          <div className="flex gap-2">
            <Input
              id={id}
              type="number"
              min={parametro.valorMinimo}
              max={parametro.valorMaximo}
              value={valor}
              aria-invalid={!enRango}
              onChange={(e) => setValor(e.target.value)}
            />
            <Button
              disabled={!enRango || numero === parametro.valor || guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? <Spinner /> : <Save />} Guardar
            </Button>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{parametro.clave}</p>
        {parametro.fechaActualizacion && (
          <p className="text-xs text-muted-foreground">
            Último cambio: {formatearFechaHora(parametro.fechaActualizacion)}
            {parametro.actualizadoPor && ` por ${parametro.actualizadoPor}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
