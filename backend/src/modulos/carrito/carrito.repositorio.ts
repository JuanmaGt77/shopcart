import { ejecutarSP, type Fila } from '../../db/ejecutor.js';
import { p, type ParametroSP } from '../../db/parametros.js';
import { SP, type NombreSP } from '../../db/procedimientos.js';

export interface DuenioCarrito {
  idUsuario: number | null;
  tokenInvitado: string | null;
}

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

export interface Carrito {
  idCarrito: number | null;
  esInvitado: boolean;
  tokenInvitado: string | null;
  cantidadArticulos: number;
  cantidadLineas: number;
  subtotal: number;
  descuento: number;
  total: number;
  cupon: { codigo: string; aplicado: boolean; estado: string | null; mensaje: string | null } | null;
  tieneProblemas: boolean;
  checkoutActivo: { idCheckout: number; expira: Date } | null;
  lineas: LineaCarrito[];
}

function armarCarrito([encabezados = [], lineas = []]: Fila[][]): Carrito {
  const h = encabezados[0] ?? {};
  const token = typeof h.tokenInvitado === 'string' ? h.tokenInvitado.toLowerCase() : null;
  return {
    idCarrito: (h.idCarrito as number | null) ?? null,
    esInvitado: Boolean(h.esInvitado),
    tokenInvitado: token,
    cantidadArticulos: Number(h.cantidadArticulos ?? 0),
    cantidadLineas: Number(h.cantidadLineas ?? 0),
    subtotal: Number(h.subtotal ?? 0),
    descuento: Number(h.descuento ?? 0),
    total: Number(h.total ?? 0),
    cupon: h.codigoCupon
      ? {
          codigo: String(h.codigoCupon),
          aplicado: h.estadoCupon === 'OK',
          estado: (h.estadoCupon as string | null) ?? null,
          mensaje: (h.mensajeCupon as string | null) ?? null,
        }
      : null,
    tieneProblemas: Boolean(h.tieneProblemas),
    checkoutActivo: h.idCheckoutActivo
      ? { idCheckout: Number(h.idCheckoutActivo), expira: h.checkoutExpira as Date }
      : null,
    lineas: lineas as unknown as LineaCarrito[],
  };
}

async function operar(nombre: NombreSP, parametros: ParametroSP[]): Promise<Carrito> {
  return armarCarrito(await ejecutarSP(nombre, parametros));
}

function duenio(d: DuenioCarrito): ParametroSP[] {
  return [p.entero('IDUsuario', d.idUsuario), p.guid('TokenInvitado', d.tokenInvitado)];
}

// El carrito se encuentra por el usuario del token o por el token de invitado; nunca por un ID que mande el cliente
export const carritoRepositorio = {
  obtener: (d: DuenioCarrito) => operar(SP.Carrito.Obtener, duenio(d)),

  agregar: (d: DuenioCarrito, idVariante: number, cantidad: number) =>
    operar(SP.Carrito.AgregarProducto, [...duenio(d), p.entero('IDVariante', idVariante), p.entero('Cantidad', cantidad)]),

  actualizarCantidad: (d: DuenioCarrito, idVariante: number, cantidad: number) =>
    operar(SP.Carrito.ActualizarCantidad, [
      ...duenio(d),
      p.entero('IDVariante', idVariante),
      p.entero('Cantidad', cantidad),
    ]),

  quitar: (d: DuenioCarrito, idVariante: number) =>
    operar(SP.Carrito.QuitarProducto, [...duenio(d), p.entero('IDVariante', idVariante)]),

  vaciar: (d: DuenioCarrito) => operar(SP.Carrito.Vaciar, duenio(d)),

  aplicarCupon: (idUsuario: number, codigo: string) =>
    operar(SP.Carrito.AplicarCupon, [p.entero('IDUsuario', idUsuario), p.ascii('Codigo', 30, codigo)]),

  quitarCupon: (idUsuario: number) => operar(SP.Carrito.QuitarCupon, [p.entero('IDUsuario', idUsuario)]),

  fusionar: (idUsuario: number, tokenInvitado: string) =>
    operar(SP.Carrito.FusionarInvitado, [p.entero('IDUsuario', idUsuario), p.guid('TokenInvitado', tokenInvitado)]),
};
