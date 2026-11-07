import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { pedir } from '@/api/cliente';
import { EstadoError, PantallaCarga } from '@/components/compartidos/estados';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { formatearFecha, formatearFechaHora } from '@/lib/formato';
import { iniciales } from '@/lib/texto';
import { NOMBRE_ROL, type Usuario } from '@/modulos/auth/tipos';
import { useSesion } from '@/modulos/auth/use-sesion';

export function PaginaPerfil() {
  const { usuario } = useSesion();
  const perfil = useQuery({
    queryKey: ['perfil', usuario?.idUsuario],
    queryFn: ({ signal }) => pedir<Usuario>('/auth/perfil', { senal: signal }),
  });

  if (perfil.isPending) return <PantallaCarga />;
  if (perfil.isError) return <EstadoError error={perfil.error} alReintentar={() => void perfil.refetch()} />;
  const p = perfil.data;

  return (
    <section className="space-y-5" aria-labelledby="titulo-perfil">
      <h1 id="titulo-perfil" className="text-2xl font-bold tracking-tight">
        Mi perfil
      </h1>
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
              {iniciales(p.nombres, p.apellidos)}
            </AvatarFallback>
          </Avatar>
          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <Dato icono={UserRound} etiqueta="Nombre" valor={`${p.nombres} ${p.apellidos}`} />
            <Dato icono={Mail} etiqueta="Correo" valor={p.correo} />
            <Dato icono={Phone} etiqueta="Teléfono" valor={p.telefono ?? 'Sin registrar'} />
            <Dato icono={ShieldCheck} etiqueta="Tipo de cuenta" valor={NOMBRE_ROL[p.rol]} />
          </dl>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Cliente desde el {formatearFecha(p.fechaCreacion)}
        {p.fechaUltimoAcceso && ` · último acceso ${formatearFechaHora(p.fechaUltimoAcceso)}`}.
      </p>
    </section>
  );
}

function Dato({ icono: Icono, etiqueta, valor }: { icono: typeof Mail; etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icono className="mt-0.5 size-4 text-primary" aria-hidden />
      <div>
        <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
        <dd className="font-medium break-all">{valor}</dd>
      </div>
    </div>
  );
}
