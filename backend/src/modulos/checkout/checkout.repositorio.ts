import { ejecutarSP, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';

export interface Checkout extends Fila {
  idCheckout: number;
  idUsuario: number;
  estado: 'ACTIVO' | 'COMPLETADO' | 'EXPIRADO' | 'CANCELADO';
  fechaExpiracion: Date;
  segundosRestantes: number;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  idPedido: number | null;
  lineas: Fila[];
}

function armarCheckout([encabezados = [], lineas = []]: Fila[][]): Checkout | null {
  const encabezado = encabezados[0];
  return encabezado ? ({ ...encabezado, lineas } as Checkout) : null;
}

export const checkoutRepositorio = {
  async iniciar(idUsuario: number, idDireccion: number, idMetodoEnvio: number) {
    return armarCheckout(
      await ejecutarSP(SP.Checkout.Iniciar, [
        p.entero('IDUsuario', idUsuario),
        p.entero('IDDireccion', idDireccion),
        p.entero('IDMetodoEnvio', idMetodoEnvio),
      ]),
    );
  },

  async obtener(idUsuario: number, idCheckout: number) {
    return armarCheckout(
      await ejecutarSP(SP.Checkout.Obtener, [p.entero('IDUsuario', idUsuario), p.entero('IDCheckout', idCheckout)]),
    );
  },

  async cancelar(idUsuario: number, idCheckout: number) {
    return armarCheckout(
      await ejecutarSP(SP.Checkout.Cancelar, [p.entero('IDUsuario', idUsuario), p.entero('IDCheckout', idCheckout)]),
    );
  },
};
