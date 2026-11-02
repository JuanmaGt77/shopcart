import type { Request } from 'express';
import { ErrorProhibido, ErrorValidacion } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import type { UsuarioAutenticado } from '../../compartido/http/tipos.js';
import { carritoRepositorio, type Carrito, type DuenioCarrito } from './carrito.repositorio.js';
import { tokenInvitado } from './carrito.esquemas.js';

/**
 * Decide de quién es el carrito: del cliente autenticado o del invitado que manda
 * X-Carrito-Token. El personal (operador/admin) no compra con su cuenta de trabajo.
 */
export function duenioDelCarrito(usuario: UsuarioAutenticado | null, req: Request): DuenioCarrito {
  if (usuario) {
    if (usuario.rol !== 'CLIENTE') {
      throw new ErrorProhibido('El carrito es solo para clientes; el personal no compra con su cuenta de trabajo.');
    }
    return { idUsuario: usuario.id, tokenInvitado: null };
  }

  const encabezado = req.get('x-carrito-token');
  if (!encabezado) return { idUsuario: null, tokenInvitado: null };

  const validado = tokenInvitado.safeParse(encabezado.trim());
  if (!validado.success) throw new ErrorValidacion('El encabezado X-Carrito-Token debe ser un UUID.');
  return { idUsuario: null, tokenInvitado: validado.data };
}

/**
 * Después de cada cambio: sincroniza las otras pestañas del cliente y refresca la
 * disponibilidad en la tienda (si el cambio canceló un checkout, sus unidades se liberaron).
 */
function avisar(duenio: DuenioCarrito, carrito: Carrito): Carrito {
  if (duenio.idUsuario) {
    eventosDominio.emit('carrito:cambio', {
      idUsuario: duenio.idUsuario,
      cantidadArticulos: carrito.cantidadArticulos,
      total: carrito.total,
    });
  }
  const variantes = carrito.lineas.map((l) => ({
    idVariante: l.idVariante,
    idProducto: l.idProducto,
    sku: l.sku,
    disponible: l.disponible,
  }));
  if (variantes.length > 0) eventosDominio.emit('inventario:cambio', variantes);
  return carrito;
}

export const carritoServicio = {
  obtener: (duenio: DuenioCarrito) => carritoRepositorio.obtener(duenio),

  async agregar(duenio: DuenioCarrito, idVariante: number, cantidad: number) {
    return avisar(duenio, await carritoRepositorio.agregar(duenio, idVariante, cantidad));
  },

  async actualizarCantidad(duenio: DuenioCarrito, idVariante: number, cantidad: number) {
    return avisar(duenio, await carritoRepositorio.actualizarCantidad(duenio, idVariante, cantidad));
  },

  async quitar(duenio: DuenioCarrito, idVariante: number) {
    return avisar(duenio, await carritoRepositorio.quitar(duenio, idVariante));
  },

  async vaciar(duenio: DuenioCarrito) {
    return avisar(duenio, await carritoRepositorio.vaciar(duenio));
  },

  async aplicarCupon(idUsuario: number, codigo: string) {
    return avisar({ idUsuario, tokenInvitado: null }, await carritoRepositorio.aplicarCupon(idUsuario, codigo));
  },

  async quitarCupon(idUsuario: number) {
    return avisar({ idUsuario, tokenInvitado: null }, await carritoRepositorio.quitarCupon(idUsuario));
  },

  /** Al iniciar sesión, lo que el visitante tenía como invitado pasa a su carrito. */
  async fusionar(idUsuario: number, tokenInvitado: string) {
    return avisar({ idUsuario, tokenInvitado: null }, await carritoRepositorio.fusionar(idUsuario, tokenInvitado));
  },
};
