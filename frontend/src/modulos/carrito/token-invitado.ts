/**
 * Token del carrito de invitado (un UUID que crea la API con el primer producto agregado).
 * Se guarda en localStorage porque no es un secreto: solo identifica un carrito sin dueño,
 * no da acceso a ninguna cuenta. Al iniciar sesión se fusiona con el carrito del cliente y se borra.
 */
const CLAVE = 'shopcart.carritoInvitado';

export function leerTokenInvitado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarTokenInvitado(token: string): void {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // Navegación privada o almacenamiento bloqueado: el carrito dura mientras la pestaña esté abierta
  }
}

export function borrarTokenInvitado(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}
