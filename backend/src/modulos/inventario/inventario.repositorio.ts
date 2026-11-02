import { consultarLista, consultarPaginado, consultarUno, ejecutarSP, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { FiltroExistencias, FiltroKardex, Movimiento } from './inventario.esquemas.js';

export interface MovimientoRegistrado {
  idKardex: number;
  idVariante: number;
  sku: string;
  tipoMovimiento: string;
  cantidad: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  reservada: number;
  disponible: number;
  motivo: string;
  fecha: Date;
}

export interface VarianteLiberada {
  idVariante: number;
  idProducto: number;
  sku: string;
  disponible: number;
}

export const inventarioRepositorio = {
  tiposMovimiento: () => consultarLista<Fila>(SP.Inventario.ListarTiposMovimiento),

  existencias: (f: FiltroExistencias) =>
    consultarPaginado<Fila>(
      SP.Inventario.ListarExistencias,
      [
        p.texto('Texto', 100, f.q),
        p.entero('IDCategoria', f.idCategoria),
        p.bit('SoloBajoStock', f.bajoStock ?? false),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  registrarMovimiento: (idAccion: number, m: Movimiento) =>
    consultarUno<MovimientoRegistrado>(SP.Inventario.RegistrarMovimiento, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDVariante', m.idVariante),
      p.ascii('CodigoTipo', 30, m.tipo),
      p.entero('Cantidad', m.cantidad),
      p.texto('Motivo', 250, m.motivo),
    ]),

  kardex: (f: FiltroKardex) =>
    consultarPaginado<Fila>(
      SP.Inventario.ListarKardex,
      [
        p.entero('IDVariante', f.idVariante),
        p.ascii('CodigoTipo', 30, f.tipo),
        p.fechaHora('Desde', f.desde ? new Date(f.desde) : null),
        p.fechaHora('Hasta', f.hasta ? new Date(f.hasta) : null),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  async conciliacion(soloDiferencias: boolean) {
    const [resumen = [], detalle = []] = await ejecutarSP(SP.Inventario.Conciliacion, [
      p.bit('SoloDiferencias', soloDiferencias),
    ]);
    return { resumen: resumen[0] ?? null, variantes: detalle };
  },

  /** Lo usa el job: marca como expirados los checkouts vencidos y devuelve sus unidades. */
  async liberarReservasVencidas() {
    const [checkouts = [], variantes = []] = await ejecutarSP(SP.Inventario.LiberarReservasVencidas);
    return {
      checkouts: checkouts as unknown as { idCheckout: number; idUsuario: number }[],
      variantes: variantes as unknown as VarianteLiberada[],
    };
  },
};
