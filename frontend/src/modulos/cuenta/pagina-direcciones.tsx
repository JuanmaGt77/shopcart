import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiDirecciones,
  textoDireccion,
  useDirecciones,
  useMutacionDireccion,
  type Direccion,
} from '@/modulos/direcciones/api';
import { DialogoDireccion } from '@/modulos/direcciones/componentes/dialogo-direccion';

export function PaginaDirecciones() {
  const direcciones = useDirecciones();
  const [dialogo, setDialogo] = useState<{ abierto: boolean; direccion?: Direccion }>({ abierto: false });
  const predeterminada = useMutacionDireccion(
    apiDirecciones.predeterminada,
    'Dirección predeterminada actualizada',
  );
  const eliminar = useMutacionDireccion(apiDirecciones.eliminar, 'Dirección eliminada');

  return (
    <section className="space-y-5" aria-labelledby="titulo-direcciones">
      <div className="flex items-center justify-between gap-3">
        <h1 id="titulo-direcciones" className="text-2xl font-bold tracking-tight">
          Mis direcciones
        </h1>
        <Button onClick={() => setDialogo({ abierto: true })}>
          <Plus /> Nueva dirección
        </Button>
      </div>

      {direcciones.isError ? (
        <EstadoError error={direcciones.error} alReintentar={() => void direcciones.refetch()} />
      ) : direcciones.data?.length === 0 ? (
        <EstadoVacio
          icono={MapPin}
          titulo="No tienes direcciones guardadas"
          descripcion="Guarda tu casa o tu oficina para pagar más rápido."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {direcciones.data
            ? direcciones.data.map((d) => (
                <li key={d.idDireccion}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" aria-hidden />
                        <p className="font-semibold">{d.alias}</p>
                        {d.esPredeterminada && <Badge variant="secondary">Predeterminada</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{textoDireccion(d)}</p>
                      {d.referencia && <p className="text-xs text-muted-foreground">Ref.: {d.referencia}</p>}
                      <p className="text-sm">
                        {d.nombreDestinatario} · {d.telefono}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogo({ abierto: true, direccion: d })}
                        >
                          <Pencil /> Editar
                        </Button>
                        {!d.esPredeterminada && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => predeterminada.mutate(d.idDireccion)}
                            disabled={predeterminada.isPending}
                          >
                            <Star /> Usar por defecto
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => eliminar.mutate(d.idDireccion)}
                          disabled={eliminar.isPending}
                        >
                          <Trash2 /> Eliminar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))
            : Array.from({ length: 2 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-40 rounded-xl" />
                </li>
              ))}
        </ul>
      )}

      <DialogoDireccion
        abierto={dialogo.abierto}
        direccion={dialogo.direccion}
        alCambiarAbierto={(abierto) => setDialogo((d) => ({ ...d, abierto }))}
      />
    </section>
  );
}
