import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pedir } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { mensajeDeError } from '@/lib/errores';
import { useSesion } from '@/modulos/auth/use-sesion';

export interface Direccion {
  idDireccion: number;
  alias: string;
  nombreDestinatario: string;
  telefono: string;
  linea1: string;
  linea2: string | null;
  zona: number | null;
  municipio: string;
  idDepartamento: number;
  departamento: string;
  codigoPostal: string | null;
  referencia: string | null;
  esPredeterminada: boolean;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

export interface DatosDireccion {
  alias: string;
  nombreDestinatario: string;
  telefono: string;
  linea1: string;
  linea2: string | null;
  zona: number | null;
  municipio: string;
  idDepartamento: number;
  codigoPostal: string | null;
  referencia: string | null;
  esPredeterminada?: boolean;
}

export const apiDirecciones = {
  listar: (senal?: AbortSignal) => pedir<Direccion[]>('/direcciones', { senal }),
  crear: (datos: DatosDireccion) => pedir<Direccion>('/direcciones', { metodo: 'POST', cuerpo: datos }),
  actualizar: (id: number, { esPredeterminada: _omitida, ...datos }: DatosDireccion) =>
    pedir<Direccion>(`/direcciones/${id}`, { metodo: 'PUT', cuerpo: datos }),
  predeterminada: (id: number) => pedir<Direccion>(`/direcciones/${id}/predeterminada`, { metodo: 'PATCH' }),
  eliminar: (id: number) => pedir<unknown>(`/direcciones/${id}`, { metodo: 'DELETE' }),
};

/** "Calzada Roosevelt 22-43, zona 11, Guatemala, Guatemala" */
export function textoDireccion(d: Direccion): string {
  return [d.linea1, d.linea2, d.zona ? `zona ${d.zona}` : null, d.municipio, d.departamento]
    .filter(Boolean)
    .join(', ');
}

function useClaveDirecciones() {
  const { usuario } = useSesion();
  return [PREFIJO.direcciones, usuario?.idUsuario] as const;
}

export function useDirecciones() {
  const clave = useClaveDirecciones();
  return useQuery({ queryKey: clave, queryFn: ({ signal }) => apiDirecciones.listar(signal) });
}

/** Mutaciones de direcciones: al terminar se vuelve a pedir la lista (la predeterminada puede cambiar). */
export function useMutacionDireccion<V, R>(funcion: (variables: V) => Promise<R>, mensajeExito: string) {
  const cliente = useQueryClient();
  const clave = useClaveDirecciones();
  return useMutation({
    mutationFn: funcion,
    onSuccess: () => {
      toast.success(mensajeExito);
      void cliente.invalidateQueries({ queryKey: clave });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
}
