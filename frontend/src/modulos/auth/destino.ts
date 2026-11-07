import type { Rol } from './tipos';

/**
 * A dónde ir después de iniciar sesión. Solo acepta rutas internas ("/algo", nunca "//otro-sitio"
 * ni "https://...") para que nadie pueda armar un enlace de login que redirija fuera de la tienda.
 */
export function destinoDespuesDeLogin(rol: Rol, volver: string | null): string {
  const interno = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : null;
  if (rol === 'CLIENTE') return interno && !interno.startsWith('/panel') ? interno : '/';
  if (interno?.startsWith('/panel')) return interno;
  return rol === 'ADMIN' ? '/panel' : '/panel/pedidos';
}
