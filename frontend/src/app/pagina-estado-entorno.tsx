import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, ShoppingCart } from 'lucide-react';
import { obtenerPublico } from '@/api/cliente';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatearFechaHora } from '@/lib/formato';

interface Salud {
  api: string;
  baseDatos: string;
  fechaServidor: string;
}

/** Página temporal: confirma que navegador -> proxy -> API -> SQL Server funciona. La reemplaza la tienda. */
export function PaginaEstadoEntorno() {
  const salud = useQuery({
    queryKey: ['salud'],
    queryFn: ({ signal }) => obtenerPublico<Salud>('/salud', signal),
    refetchInterval: 10_000,
  });

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShoppingCart className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ShopCart</h1>
          <p className="text-sm text-muted-foreground">Todo para tu ruta</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Estado del entorno</CardTitle>
          <CardDescription>Frontend (Vite) → proxy → API (Express) → SQL Server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {salud.isPending && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner /> Consultando la API…
            </p>
          )}
          {salud.isError && (
            <p className="flex items-center gap-2 text-destructive">
              <CircleX className="size-5" aria-hidden /> {salud.error.message}
            </p>
          )}
          {salud.data && (
            <>
              <Fila nombre="API" valor={salud.data.api} />
              <Fila nombre="Base de datos" valor={salud.data.baseDatos} />
              <p className="text-sm text-muted-foreground">
                Hora del servidor: {formatearFechaHora(salud.data.fechaServidor)}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  const ok = valor === 'OK';
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        {ok ? (
          <CircleCheck className="size-5 text-exito" aria-hidden />
        ) : (
          <CircleX className="size-5 text-destructive" aria-hidden />
        )}
        {nombre}
      </span>
      <Badge variant={ok ? 'secondary' : 'destructive'}>{valor}</Badge>
    </div>
  );
}
