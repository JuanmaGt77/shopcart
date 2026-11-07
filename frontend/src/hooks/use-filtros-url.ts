import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

/**
 * Los filtros de los listados viven en la URL (?q=aceite&idCategoria=4&pagina=2): se pueden
 * compartir, el botón Atrás funciona y al recargar se conserva la búsqueda.
 * El esquema limpia lo que venga mal escrito en la URL (cada campo usa .catch), así nunca truena.
 */
export function useFiltrosUrl<S extends z.ZodObject>(esquema: S) {
  const [parametros, setParametros] = useSearchParams();

  const filtros = useMemo(
    () => esquema.parse(Object.fromEntries(parametros)) as z.output<S>,
    [parametros, esquema],
  );

  const cambiar = useCallback(
    (cambios: Record<string, string | number | boolean | null | undefined>) => {
      setParametros((actuales) => {
        const siguientes = new URLSearchParams(actuales);
        for (const [clave, valor] of Object.entries(cambios)) {
          if (valor === undefined || valor === null || valor === '' || valor === false)
            siguientes.delete(clave);
          else siguientes.set(clave, String(valor));
        }
        // Cambiar un filtro regresa a la primera página
        if (!('pagina' in cambios)) siguientes.delete('pagina');
        if (siguientes.get('pagina') === '1') siguientes.delete('pagina');
        return siguientes;
      });
    },
    [setParametros],
  );

  const limpiar = useCallback(
    (conservar: string[] = []) => {
      setParametros((actuales) => {
        const siguientes = new URLSearchParams();
        for (const clave of conservar) {
          const valor = actuales.get(clave);
          if (valor) siguientes.set(clave, valor);
        }
        return siguientes;
      });
    },
    [setParametros],
  );

  return { filtros, cambiar, limpiar };
}

/** Piezas para armar esquemas de URL tolerantes: lo inválido se ignora en lugar de fallar. */
export const enUrl = {
  texto: (maximo = 100) => z.string().trim().max(maximo).optional().catch(undefined),
  entero: () => z.coerce.number().int().positive().optional().catch(undefined),
  monto: () => z.coerce.number().min(0).optional().catch(undefined),
  bandera: () =>
    z
      .enum(['true', '1'])
      .transform(() => true)
      .optional()
      .catch(undefined),
  pagina: () => z.coerce.number().int().min(1).catch(1),
  opcion: <const T extends readonly [string, ...string[]]>(valores: T) =>
    z.enum(valores).optional().catch(undefined),
};
