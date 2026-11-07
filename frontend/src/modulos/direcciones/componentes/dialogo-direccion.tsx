import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoTexto } from '@/components/formulario/campo-texto';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { aplicarErroresDeCampo } from '@/lib/errores';
import { useDepartamentos } from '@/modulos/sistema/catalogos';
import { apiDirecciones, useMutacionDireccion, type DatosDireccion, type Direccion } from '../api';

/** Mismas reglas que direcciones.esquemas.ts de la API. */
const esquema = z.object({
  alias: z.string().trim().min(1, 'Ponle un nombre, por ejemplo "Casa"').max(50),
  nombreDestinatario: z.string().trim().min(1, '¿Quién recibe?').max(150),
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9 +-]{8,20}$/, 'El teléfono debe tener al menos 8 dígitos'),
  linea1: z.string().trim().min(1, 'Escribe la dirección').max(200),
  linea2: z.string().trim().max(200),
  zona: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 25),
      'La zona va de 1 a 25',
    ),
  municipio: z.string().trim().min(1, 'Escribe el municipio').max(100),
  idDepartamento: z.string().min(1, 'Elige el departamento'),
  codigoPostal: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{5}$/.test(v), 'El código postal tiene 5 dígitos'),
  referencia: z.string().trim().max(250),
  esPredeterminada: z.boolean(),
});
type Formulario = z.infer<typeof esquema>;

const CAMPOS = [
  'alias',
  'nombreDestinatario',
  'telefono',
  'linea1',
  'linea2',
  'zona',
  'municipio',
  'idDepartamento',
  'codigoPostal',
  'referencia',
] as const;

function valoresIniciales(direccion?: Direccion): Formulario {
  return {
    alias: direccion?.alias ?? '',
    nombreDestinatario: direccion?.nombreDestinatario ?? '',
    telefono: direccion?.telefono ?? '',
    linea1: direccion?.linea1 ?? '',
    linea2: direccion?.linea2 ?? '',
    zona: direccion?.zona?.toString() ?? '',
    municipio: direccion?.municipio ?? '',
    idDepartamento: direccion?.idDepartamento.toString() ?? '',
    codigoPostal: direccion?.codigoPostal ?? '',
    referencia: direccion?.referencia ?? '',
    esPredeterminada: direccion?.esPredeterminada ?? false,
  };
}

function aDatos(f: Formulario): DatosDireccion {
  const opcional = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    alias: f.alias,
    nombreDestinatario: f.nombreDestinatario,
    telefono: f.telefono,
    linea1: f.linea1,
    linea2: opcional(f.linea2),
    zona: f.zona === '' ? null : Number(f.zona),
    municipio: f.municipio,
    idDepartamento: Number(f.idDepartamento),
    codigoPostal: opcional(f.codigoPostal),
    referencia: opcional(f.referencia),
    esPredeterminada: f.esPredeterminada,
  };
}

interface DialogoDireccionProps {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  /** Si viene, se edita; si no, se crea una nueva. */
  direccion?: Direccion;
  alGuardar?: (direccion: Direccion) => void;
}

export function DialogoDireccion({ abierto, alCambiarAbierto, direccion, alGuardar }: DialogoDireccionProps) {
  const departamentos = useDepartamentos();
  const idPredeterminada = useId();
  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    values: valoresIniciales(direccion),
  });

  const guardar = useMutacionDireccion(
    (datos: DatosDireccion) =>
      direccion ? apiDirecciones.actualizar(direccion.idDireccion, datos) : apiDirecciones.crear(datos),
    direccion ? 'Dirección actualizada' : 'Dirección guardada',
  );

  const enviar = formulario.handleSubmit((valores) =>
    guardar.mutate(aDatos(valores), {
      onSuccess: (guardada) => {
        alGuardar?.(guardada);
        alCambiarAbierto(false);
        formulario.reset();
      },
      onError: (error) => aplicarErroresDeCampo(error, formulario.setError, CAMPOS),
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{direccion ? 'Editar dirección' : 'Nueva dirección'}</DialogTitle>
          <DialogDescription>
            Donde entregamos tu pedido o el contacto para recogerlo en la estación.
          </DialogDescription>
        </DialogHeader>
        <form id="formulario-direccion" onSubmit={enviar} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                control={formulario.control}
                name="alias"
                etiqueta="Nombre de la dirección"
                placeholder="Casa, Oficina…"
              />
              <CampoTexto
                control={formulario.control}
                name="telefono"
                etiqueta="Teléfono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <CampoTexto
              control={formulario.control}
              name="nombreDestinatario"
              etiqueta="Quién recibe"
              autoComplete="name"
            />
            <CampoTexto
              control={formulario.control}
              name="linea1"
              etiqueta="Dirección"
              placeholder="Calle, avenida, número de casa"
              autoComplete="address-line1"
            />
            <CampoTexto
              control={formulario.control}
              name="linea2"
              etiqueta="Complemento (opcional)"
              placeholder="Colonia, edificio, apartamento"
              autoComplete="address-line2"
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoTexto
                control={formulario.control}
                name="zona"
                etiqueta="Zona (opcional)"
                inputMode="numeric"
              />
              <CampoTexto
                control={formulario.control}
                name="codigoPostal"
                etiqueta="Código postal (opcional)"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto control={formulario.control} name="municipio" etiqueta="Municipio" />
              <Controller
                control={formulario.control}
                name="idDepartamento"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="departamento">Departamento</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="departamento" aria-invalid={fieldState.invalid} className="w-full">
                        <SelectValue placeholder={departamentos.isPending ? 'Cargando…' : 'Elige uno'} />
                      </SelectTrigger>
                      <SelectContent>
                        {departamentos.data?.map((d) => (
                          <SelectItem key={d.idDepartamento} value={String(d.idDepartamento)}>
                            {d.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
            <CampoTexto
              control={formulario.control}
              name="referencia"
              etiqueta="Referencia (opcional)"
              placeholder="Portón negro, frente al parque…"
            />
            {!direccion && (
              <Controller
                control={formulario.control}
                name="esPredeterminada"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id={idPredeterminada}
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                    <FieldLabel htmlFor={idPredeterminada} className="font-normal">
                      Usar como dirección predeterminada
                    </FieldLabel>
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="formulario-direccion" disabled={guardar.isPending}>
            {guardar.isPending && <Spinner />} Guardar dirección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
