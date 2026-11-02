import { consultarLista, consultarPaginado, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { FiltroBitacora } from './bitacora.esquemas.js';

export const bitacoraRepositorio = {
  listar: (f: FiltroBitacora) =>
    consultarPaginado<Fila>(
      SP.Bitacora.Listar,
      [
        p.ascii('Modulo', 20, f.modulo),
        p.ascii('Entidad', 40, f.entidad),
        p.ascii('IDEntidad', 40, f.idEntidad),
        p.ascii('Accion', 20, f.accion),
        p.entero('IDUsuario', f.idUsuario),
        p.fechaHora('Desde', f.desde ? new Date(f.desde) : null),
        p.fechaHora('Hasta', f.hasta ? new Date(f.hasta) : null),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  resumenModulos: () => consultarLista<Fila>(SP.Bitacora.ResumenModulos),
};
