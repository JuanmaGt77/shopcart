import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { CampoTexto } from '@/components/formulario/campo-texto';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDeError } from '@/lib/errores';
import { iniciarSesion } from '../api';
import { MarcoAcceso } from '../componentes/marco-acceso';
import { destinoDespuesDeLogin } from '../destino';
import { useDespuesDeLogin } from '../use-despues-de-login';
import { useSesion } from '../use-sesion';

const esquema = z.object({
  correo: z.string().trim().min(1, 'Escribe tu correo').email('El correo no es válido'),
  contrasena: z.string().min(1, 'Escribe tu contraseña'),
});
type Formulario = z.infer<typeof esquema>;

/** Cuentas de las semillas, para que quien evalúe pueda entrar con un clic. */
const CUENTAS_DE_PRUEBA = [
  { rol: 'Cliente', correo: 'cliente@shopcart.test', contrasena: 'Cliente123!' },
  { rol: 'Operador', correo: 'operador@shopcart.test', contrasena: 'Operador123!' },
  { rol: 'Admin', correo: 'admin@shopcart.test', contrasena: 'Admin123!' },
];

export function PaginaLogin() {
  const sesion = useSesion();
  const [parametros] = useSearchParams();
  const despuesDeLogin = useDespuesDeLogin();
  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '', contrasena: '' },
  });

  const login = useMutation({ mutationFn: iniciarSesion, onSuccess: despuesDeLogin });

  // Si ya tiene sesión (por ejemplo, volvió con el botón Atrás), no tiene sentido mostrar el login
  if (sesion.usuario && !login.isPending && !login.isSuccess) {
    return <Navigate to={destinoDespuesDeLogin(sesion.usuario.rol, parametros.get('volver'))} replace />;
  }

  return (
    <MarcoAcceso titulo="Inicia sesión" subtitulo="Entra para pagar tu carrito y seguir tus pedidos.">
      <form
        onSubmit={formulario.handleSubmit((datos) => login.mutate(datos))}
        noValidate
        className="space-y-5"
      >
        <FieldGroup>
          <CampoTexto
            control={formulario.control}
            name="correo"
            etiqueta="Correo electrónico"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tucorreo@ejemplo.com"
          />
          <CampoTexto
            control={formulario.control}
            name="contrasena"
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
          />
        </FieldGroup>

        {login.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{mensajeDeError(login.error)}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="xl" className="w-full" disabled={login.isPending}>
          {login.isPending ? <Spinner /> : <KeyRound />}
          Iniciar sesión
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link
          to={`/registro${parametros.size ? `?${parametros.toString()}` : ''}`}
          className="font-medium text-primary hover:underline"
        >
          Regístrate gratis
        </Link>
      </p>

      <section className="rounded-xl border border-dashed p-4" aria-labelledby="cuentas-prueba">
        <h2 id="cuentas-prueba" className="mb-1 text-sm font-semibold">
          Cuentas de prueba
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Llena el formulario con una cuenta de las semillas.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CUENTAS_DE_PRUEBA.map((cuenta) => (
            <Button
              key={cuenta.correo}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                formulario.reset({ correo: cuenta.correo, contrasena: cuenta.contrasena });
                login.reset();
              }}
            >
              {cuenta.rol}
            </Button>
          ))}
        </div>
      </section>
    </MarcoAcceso>
  );
}
