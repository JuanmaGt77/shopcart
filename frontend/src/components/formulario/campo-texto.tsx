import { useId, type ComponentProps, type ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface CampoTextoProps<T extends FieldValues> extends Omit<ComponentProps<'input'>, 'name' | 'id'> {
  control: Control<T>;
  name: Path<T>;
  etiqueta: string;
  descripcion?: ReactNode;
}

/** Campo de texto conectado a React Hook Form, con su etiqueta, ayuda y mensaje de error accesibles. */
export function CampoTexto<T extends FieldValues>({
  control,
  name,
  etiqueta,
  descripcion,
  ...input
}: CampoTextoProps<T>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
          <Input
            id={id}
            {...input}
            {...field}
            value={(field.value as string | number | undefined) ?? ''}
            aria-invalid={fieldState.invalid}
          />
          {descripcion && <FieldDescription>{descripcion}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
