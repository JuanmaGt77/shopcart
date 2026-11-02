import { consultarPaginado, consultarUno, type Fila } from '../../db/ejecutor.js';
import { p, type ParametroSP } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { CambiosCupon, FiltroCupones, NuevoCupon } from './cupones.esquemas.js';

function camposComunes(c: CambiosCupon): ParametroSP[] {
  return [
    p.texto('Descripcion', 200, c.descripcion),
    p.ascii('TipoDescuento', 10, c.tipoDescuento),
    p.dinero('Valor', c.valor),
    p.dinero('MontoMinimo', c.montoMinimo),
    p.dinero('DescuentoMaximo', c.descuentoMaximo),
    p.entero('IDCategoria', c.idCategoria),
    p.fechaHora('FechaInicio', new Date(c.fechaInicio)),
    p.fechaHora('FechaFin', new Date(c.fechaFin)),
    p.entero('LimiteUsosTotal', c.limiteUsosTotal),
    p.entero('LimiteUsosPorCliente', c.limiteUsosPorCliente),
  ];
}

export const cuponesRepositorio = {
  listar: (f: FiltroCupones) =>
    consultarPaginado<Fila>(
      SP.Cupones.Listar,
      [
        p.texto('Texto', 100, f.q),
        p.ascii('Estado', 12, f.estado),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  obtener: (id: number) => consultarUno<Fila>(SP.Cupones.Obtener, [p.entero('IDCupon', id)]),

  crear: (idAccion: number, c: NuevoCupon) =>
    consultarUno<Fila>(SP.Cupones.Crear, [
      p.entero('IDUsuarioAccion', idAccion),
      p.ascii('Codigo', 30, c.codigo),
      ...camposComunes(c),
    ]),

  actualizar: (idAccion: number, id: number, c: CambiosCupon) =>
    consultarUno<Fila>(SP.Cupones.Actualizar, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCupon', id),
      ...camposComunes(c),
    ]),

  cambiarEstado: (idAccion: number, id: number, activo: boolean) =>
    consultarUno<Fila>(SP.Cupones.CambiarEstado, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCupon', id),
      p.bit('Activo', activo),
    ]),

  eliminar: (idAccion: number, id: number) =>
    consultarUno<{ resultado: 'ELIMINADO' | 'DESACTIVADO'; idCupon: number }>(SP.Cupones.Eliminar, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCupon', id),
    ]),

  usos: (id: number, pagina: number, tamanoPagina: number) =>
    consultarPaginado<Fila>(
      SP.Cupones.ListarUsos,
      [p.entero('IDCupon', id), p.entero('Pagina', pagina), p.entero('TamanoPagina', tamanoPagina)],
      pagina,
      tamanoPagina,
    ),
};
