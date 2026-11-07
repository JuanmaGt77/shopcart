import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { fusionarCarritoInvitado } from '@/modulos/carrito/api';
import { destinoDespuesDeLogin } from './destino';
import type { Usuario } from './tipos';

/**
 * Lo que pasa justo después de iniciar sesión o registrarse:
 * 1. Si es cliente y armó un carrito como invitado, se pasa a su cuenta (la API ajusta las
 *    cantidades a lo disponible y lo avisa).
 * 2. Regresa a la página donde estaba (?volver=) o a su área según el rol.
 */
export function useDespuesDeLogin() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();

  return async (usuario: Usuario) => {
    if (usuario.rol === 'CLIENTE') {
      try {
        const carrito = await fusionarCarritoInvitado();
        if (carrito && carrito.cantidadArticulos > 0) {
          toast.success('Agregamos a tu cuenta lo que tenías en el carrito.', {
            description: carrito.tieneProblemas
              ? 'Algunas cantidades se ajustaron a lo disponible.'
              : `${carrito.cantidadArticulos} artículo(s) en tu carrito.`,
          });
        }
      } catch {
        toast.warning('No pudimos recuperar el carrito que armaste como visitante.');
      }
    }
    toast.success(`¡Hola, ${usuario.nombres.split(' ')[0]}!`);
    navegar(destinoDespuesDeLogin(usuario.rol, parametros.get('volver')), { replace: true });
  };
}
