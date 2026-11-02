import {
  consultarLista,
  consultarPaginado,
  consultarUno,
  ejecutarSP,
  parsearJson,
  type Fila,
} from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import { tablaLineasDevolucion } from '../../db/tablas.js';
import type { EstadoPedido } from './maquina-estados.js';
import type { DatosDevolucion, FiltroMisPedidos, FiltroPedidos } from './pedidos.esquemas.js';

export interface PedidoDetalle extends Fila {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  cliente: string;
  estadoCodigo: EstadoPedido;
  total: number;
  lineas: Fila[];
  historial: Fila[];
  pago: Fila | null;
  devoluciones: Fila[];
}

/** El SP devuelve 5 resultados: encabezado, líneas, historial, pago y devoluciones. */
function armarPedido([encabezados = [], lineas = [], historial = [], pagos = [], devoluciones = []]: Fila[][]) {
  const encabezado = encabezados[0];
  if (!encabezado) return null;
  return {
    ...encabezado,
    lineas,
    historial,
    pago: pagos[0] ?? null,
    devoluciones: devoluciones.map((d) => ({ ...d, lineas: parsearJson(d.lineas) })),
  } as unknown as PedidoDetalle;
}

const ORDEN: Record<FiltroPedidos['ordenarPor'], string> = { fecha: 'FECHA', total: 'TOTAL', numero: 'NUMERO' };

export const pedidosRepositorio = {
  /** EsPersonal = 0 hace que el SP responda 403 si el pedido es de otro cliente. */
  async obtener(idPedido: number, idSolicitante: number, esPersonal: boolean) {
    return armarPedido(
      await ejecutarSP(SP.Pedidos.Obtener, [
        p.entero('IDPedido', idPedido),
        p.entero('IDUsuarioSolicitante', idSolicitante),
        p.bit('EsPersonal', esPersonal),
      ]),
    );
  },

  porIdempotencia: (idUsuario: number, clave: string) =>
    consultarUno<{ idPedido: number; idCheckout: number }>(SP.Pedidos.ObtenerPorIdempotencia, [
      p.entero('IDUsuario', idUsuario),
      p.ascii('ClaveIdempotencia', 100, clave),
    ]),

  crearPedido: (datos: {
    idUsuario: number;
    idCheckout: number;
    claveIdempotencia: string;
    codigoAutorizacion: string;
    marca: string;
    ultimosDigitos: string;
  }) =>
    consultarUno<{ idPedido: number; esDuplicado: boolean }>(SP.Pedidos.CrearPedido, [
      p.entero('IDUsuario', datos.idUsuario),
      p.entero('IDCheckout', datos.idCheckout),
      p.ascii('ClaveIdempotencia', 100, datos.claveIdempotencia),
      p.ascii('CodigoAutorizacion', 50, datos.codigoAutorizacion),
      p.ascii('MarcaTarjeta', 20, datos.marca),
      p.caracteres('UltimosDigitos', 4, datos.ultimosDigitos),
    ]),

  misPedidos: (idUsuario: number, f: FiltroMisPedidos) =>
    consultarPaginado<Fila>(
      SP.Pedidos.ListarMisPedidos,
      [
        p.entero('IDUsuario', idUsuario),
        p.ascii('CodigoEstado', 20, f.estado),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  listar: (f: FiltroPedidos) =>
    consultarPaginado<Fila>(
      SP.Pedidos.Listar,
      [
        p.ascii('CodigoEstado', 20, f.estado),
        p.texto('Cliente', 100, f.cliente),
        p.entero('IDUsuarioCliente', f.idCliente),
        p.fecha('Desde', f.desde),
        p.fecha('Hasta', f.hasta),
        p.ascii('OrdenarPor', 10, ORDEN[f.ordenarPor]),
        p.ascii('Direccion', 4, f.direccion.toUpperCase()),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  async cambiarEstado(idAccion: number, idPedido: number, estado: EstadoPedido, comentario?: string | null) {
    return armarPedido(
      await ejecutarSP(SP.Pedidos.CambiarEstado, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDPedido', idPedido),
        p.ascii('CodigoEstadoNuevo', 20, estado),
        p.texto('Comentario', 250, comentario),
      ]),
    );
  },

  async cancelar(idAccion: number, idPedido: number, motivo: string, soloPropio: boolean) {
    return armarPedido(
      await ejecutarSP(SP.Pedidos.Cancelar, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDPedido', idPedido),
        p.texto('Motivo', 250, motivo),
        p.bit('SoloPropio', soloPropio),
      ]),
    );
  },

  async registrarDevolucion(idAccion: number, idPedido: number, datos: DatosDevolucion) {
    const [devoluciones = [], lineas = []] = await ejecutarSP(SP.Devoluciones.Registrar, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDPedido', idPedido),
      p.texto('Motivo', 250, datos.motivo),
      p.tabla('Lineas', tablaLineasDevolucion(datos.lineas)),
    ]);
    return { ...(devoluciones[0] ?? {}), lineas };
  },

  async devoluciones(idPedido: number) {
    const filas = await consultarLista<Fila>(SP.Devoluciones.ListarPorPedido, [p.entero('IDPedido', idPedido)]);
    return filas.map((f) => ({ ...f, lineas: parsearJson(f.lineas) }));
  },
};
