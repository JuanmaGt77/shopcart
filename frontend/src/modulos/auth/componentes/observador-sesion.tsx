import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSesion } from '../use-sesion';

/**
 * - Cuando cambia quién tiene la sesión (login, logout, otra cuenta) se reinician todas las
 *   consultas: los datos de una cuenta nunca se muestran a otra en el mismo navegador.
 * - Avisa por qué se cerró la sesión cuando no fue el usuario quien la cerró.
 */
export function ObservadorSesion() {
  const cliente = useQueryClient();
  const sesion = useSesion();
  const idAnterior = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (sesion.estado === 'cargando') return;
    const id = sesion.usuario?.idUsuario ?? null;
    if (idAnterior.current !== undefined && idAnterior.current !== id) void cliente.resetQueries();
    idAnterior.current = id;
  }, [sesion, cliente]);

  useEffect(() => {
    if (sesion.motivoCierre === 'revocada') {
      toast.error('Tu cuenta fue desactivada', { description: 'Un administrador cerró tu sesión.' });
    } else if (sesion.motivoCierre === 'expirada') {
      toast.warning('Tu sesión venció', { description: 'Vuelve a iniciar sesión para continuar.' });
    }
  }, [sesion.motivoCierre]);

  return null;
}
