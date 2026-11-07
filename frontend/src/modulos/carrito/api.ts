import { pedir, type OpcionesSolicitud } from '@/api/cliente';
import { almacenSesion } from '@/modulos/auth/almacen-sesion';
import { borrarTokenInvitado, guardarTokenInvitado, leerTokenInvitado } from './token-invitado';

export interface LineaCarrito {
  idVariante: number;
  sku: string;
  idProducto: number;
  nombreProducto: string;
  descripcionVariante: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  disponible: number;
  vendible: boolean;
  excedeDisponible: boolean;
  imagenUrl: string | null;
}

export interface CuponCarrito {
  codigo: string;
  aplicado: boolean;
  estado: string | null;
  mensaje: string | null;
}

export interface Carrito {
  idCarrito: number | null;
  esInvitado: boolean;
  tokenInvitado: string | null;
  cantidadArticulos: number;
  cantidadLineas: number;
  subtotal: number;
  descuento: number;
  total: number;
  cupon: CuponCarrito | null;
  tieneProblemas: boolean;
  checkoutActivo: { idCheckout: number; expira: string } | null;
  lineas: LineaCarrito[];
}

/** Con sesión manda el token de acceso; sin sesión, el encabezado del carrito de invitado. */
function opcionesCarrito(opciones: OpcionesSolicitud = {}): OpcionesSolicitud {
  const token = almacenSesion.token() ? null : leerTokenInvitado();
  return token
    ? { ...opciones, encabezados: { ...opciones.encabezados, 'X-Carrito-Token': token } }
    : opciones;
}

/** La API crea el carrito de invitado con el primer producto y devuelve su token: se guarda. */
function recordarInvitado(carrito: Carrito): Carrito {
  if (carrito.esInvitado && carrito.tokenInvitado) guardarTokenInvitado(carrito.tokenInvitado);
  return carrito;
}

export const apiCarrito = {
  obtener: (senal?: AbortSignal) => pedir<Carrito>('/carrito', opcionesCarrito({ senal })),

  agregar: async (idVariante: number, cantidad: number) =>
    recordarInvitado(
      await pedir<Carrito>(
        '/carrito/items',
        opcionesCarrito({ metodo: 'POST', cuerpo: { idVariante, cantidad } }),
      ),
    ),

  cambiarCantidad: (idVariante: number, cantidad: number) =>
    pedir<Carrito>(
      `/carrito/items/${idVariante}`,
      opcionesCarrito({ metodo: 'PATCH', cuerpo: { cantidad } }),
    ),

  quitar: (idVariante: number) =>
    pedir<Carrito>(`/carrito/items/${idVariante}`, opcionesCarrito({ metodo: 'DELETE' })),

  vaciar: () => pedir<Carrito>('/carrito', opcionesCarrito({ metodo: 'DELETE' })),

  aplicarCupon: (codigo: string) => pedir<Carrito>('/carrito/cupon', { metodo: 'POST', cuerpo: { codigo } }),

  quitarCupon: () => pedir<Carrito>('/carrito/cupon', { metodo: 'DELETE' }),
};

/**
 * Justo después de iniciar sesión como cliente: pasa lo que había en el carrito de invitado
 * al carrito de su cuenta. Devuelve el carrito fusionado, o null si no había nada que fusionar.
 */
export async function fusionarCarritoInvitado(): Promise<Carrito | null> {
  const tokenInvitado = leerTokenInvitado();
  if (!tokenInvitado) return null;
  try {
    return await pedir<Carrito>('/carrito/fusionar', { metodo: 'POST', cuerpo: { tokenInvitado } });
  } finally {
    borrarTokenInvitado();
  }
}
