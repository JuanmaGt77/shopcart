import { consultarLista, consultarUno, parsearJson, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';

export interface EstadoPedidoCatalogo {
  idEstadoPedido: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esInicial: boolean;
  esFinal: boolean;
  cuentaComoVenta: boolean;
  orden: number;
  siguientes: { codigo: string; nombre: string }[];
}

export interface Parametro {
  clave: string;
  valor: number;
  valorMinimo: number;
  valorMaximo: number;
  descripcion: string;
}

export const sistemaRepositorio = {
  salud: () => consultarUno<{ estado: string; baseDatos: string; fechaServidorUtc: Date }>(SP.Sistema.Salud),

  departamentos: () => consultarLista<{ idDepartamento: number; nombre: string }>(SP.Direcciones.ListarDepartamentos),

  metodosEnvio: () => consultarLista<Fila>(SP.Checkout.ListarMetodosEnvio),

  async estadosPedido(): Promise<EstadoPedidoCatalogo[]> {
    const filas = await consultarLista<Fila>(SP.Pedidos.ListarEstados);
    return filas.map((fila) => ({
      ...(fila as unknown as EstadoPedidoCatalogo),
      siguientes: parsearJson<{ codigo: string; nombre: string }>(fila.siguientes),
    }));
  },

  parametros: () => consultarLista<Parametro>(SP.Sistema.ListarParametros),

  actualizarParametro: (idUsuario: number, clave: string, valor: number) =>
    consultarUno<Parametro>(SP.Sistema.ActualizarParametro, [
      p.entero('IDUsuarioAccion', idUsuario),
      p.ascii('Clave', 50, clave),
      p.entero('Valor', valor),
    ]),
};
