import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorApi } from '@/api/cliente';

/** Mensaje para mostrar al usuario. Los de la API ya vienen redactados en español por el backend. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/** true si el error es de la API con alguno de esos códigos. */
export function esErrorApi(error: unknown, ...codigos: string[]): error is ErrorApi {
  return error instanceof ErrorApi && (codigos.length === 0 || codigos.includes(error.codigo));
}

/**
 * Si la API rechazó el formulario por validación (400 con detalles por campo), pinta cada mensaje
 * en su campo. Devuelve true si pintó alguno; si no, el llamador muestra el mensaje general.
 */
export function aplicarErroresDeCampo<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
): boolean {
  if (!(error instanceof ErrorApi)) return false;
  let aplicados = 0;
  for (const detalle of error.erroresDeCampo) {
    const campo = campos.find((c) => c === detalle.campo);
    if (campo) {
      setError(campo, { type: 'server', message: detalle.mensaje });
      aplicados++;
    }
  }
  return aplicados > 0;
}
