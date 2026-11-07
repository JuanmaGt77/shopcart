import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { CampoTexto } from '@/components/formulario/campo-texto';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { aplicarErroresDeCampo, mensajeDeError } from '@/lib/errores';
import { registrarse } from '../api';
import { MarcoAcceso } from '../componentes/marco-acceso';
import { useDespuesDeLogin } from '../use-despues-de-login';

/** Las mismas reglas que valida la API (auth.esquemas.ts), para avisar antes de enviar. */
const esquema = z
  .object({
    nombres: z.string().trim().min(1, 'Escribe tu nombre').max(100),
    apellidos: z.string().trim().min(1, 'Escribe tus apellidos').max(100),
    correo: z.string().trim().min(1, 'Escribe tu correo').email('El correo no es válido').max(254),
    telefono: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[0-9 +-]{8,20}$/.test(v), 'El teléfono debe tener al menos 8 dígitos'),
    contrasena: z
      .string()
      .min(8, 'Al menos 8 caracteres')
      .max(128)
      .regex(/[a-z]/, 'Necesita al menos una minúscula')
      .regex(/[A-Z]/, 'Necesita al menos una mayúscula')
      .regex(/\d/, 'Necesita al menos un número'),
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  });
type Formulario = z.infer<typeof esquema>;

const CAMPOS_API = ['nombres', 'apellidos', 'correo', 'telefono', 'contrasena'] as const;

export function PaginaRegistro() {
  const [parametros] = useSearchParams();
  const despuesDeLogin = useDespuesDeLogin();
  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { nombres: '', apellidos: '', correo: '', telefono: '', contrasena: '', confirmacion: '' },
  });

  const registro = useMutation({
    mutationFn: ({ confirmacion: _confirmacion, telefono, ...datos }: Formulario) =>
      registrarse({ ...datos, telefono: telefono || undefined }),
    onSuccess: despuesDeLogin,
    onError: (error) => aplicarErroresDeCampo(error, formulario.setError, CAMPOS_API),
  });

  return (
    <MarcoAcceso
      titulo="Crea tu cuenta"
      subtitulo="Compra en línea y recibe en tu casa o recoge en la estación."
    >
      <form
        onSubmit={formulario.handleSubmit((datos) => registro.mutate(datos))}
        noValidate
        className="space-y-5"
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              control={formulario.control}
              name="nombres"
              etiqueta="Nombres"
              autoComplete="given-name"
            />
            <CampoTexto
              control={formulario.control}
              name="apellidos"
              etiqueta="Apellidos"
              autoComplete="family-name"
            />
          </div>
          <CampoTexto
            control={formulario.control}
            name="correo"
            etiqueta="Correo electrónico"
            type="email"
            autoComplete="email"
            inputMode="email"
          />
          <CampoTexto
            control={formulario.control}
            name="telefono"
            etiqueta="Teléfono (opcional)"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="5555 1234"
          />
          <CampoTexto
            control={formulario.control}
            name="contrasena"
            etiqueta="Contraseña"
            type="password"
            autoComplete="new-password"
            descripcion="Mínimo 8 caracteres, con mayúscula, minúscula y número."
          />
          <CampoTexto
            control={formulario.control}
            name="confirmacion"
            etiqueta="Confirma la contraseña"
            type="password"
            autoComplete="new-password"
          />
        </FieldGroup>

        {registro.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{mensajeDeError(registro.error)}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="xl" className="w-full" disabled={registro.isPending}>
          {registro.isPending ? <Spinner /> : <UserPlus />}
          Crear cuenta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          to={`/login${parametros.size ? `?${parametros.toString()}` : ''}`}
          className="font-medium text-primary hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </MarcoAcceso>
  );
}
