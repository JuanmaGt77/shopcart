import { consultarLista, consultarUno, type Fila } from '../../db/ejecutor.js';
import { p, type ParametroSP } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import type { CambiosDireccion, NuevaDireccion } from './direcciones.esquemas.js';

function camposComunes(d: CambiosDireccion): ParametroSP[] {
  return [
    p.texto('Alias', 50, d.alias),
    p.texto('NombreDestinatario', 150, d.nombreDestinatario),
    p.ascii('Telefono', 20, d.telefono),
    p.texto('Linea1', 200, d.linea1),
    p.texto('Linea2', 200, d.linea2),
    p.entero('Zona', d.zona),
    p.texto('Municipio', 100, d.municipio),
    p.entero('IDDepartamento', d.idDepartamento),
    p.ascii('CodigoPostal', 10, d.codigoPostal),
    p.texto('Referencia', 250, d.referencia),
  ];
}

// El IDUsuario siempre es el del token: cada SP filtra por dueño y responde 403 si la dirección es de otro
export const direccionesRepositorio = {
  listar: (idUsuario: number) => consultarLista<Fila>(SP.Direcciones.Listar, [p.entero('IDUsuario', idUsuario)]),

  obtener: (idUsuario: number, idDireccion: number) =>
    consultarUno<Fila>(SP.Direcciones.Obtener, [p.entero('IDUsuario', idUsuario), p.entero('IDDireccion', idDireccion)]),

  crear: (idUsuario: number, d: NuevaDireccion) =>
    consultarUno<Fila>(SP.Direcciones.Crear, [
      p.entero('IDUsuario', idUsuario),
      ...camposComunes(d),
      p.bit('EsPredeterminada', d.esPredeterminada),
    ]),

  actualizar: (idUsuario: number, idDireccion: number, d: CambiosDireccion) =>
    consultarUno<Fila>(SP.Direcciones.Actualizar, [
      p.entero('IDUsuario', idUsuario),
      p.entero('IDDireccion', idDireccion),
      ...camposComunes(d),
    ]),

  hacerPredeterminada: (idUsuario: number, idDireccion: number) =>
    consultarUno<Fila>(SP.Direcciones.EstablecerPredeterminada, [
      p.entero('IDUsuario', idUsuario),
      p.entero('IDDireccion', idDireccion),
    ]),

  eliminar: (idUsuario: number, idDireccion: number) =>
    consultarUno<Fila>(SP.Direcciones.Eliminar, [p.entero('IDUsuario', idUsuario), p.entero('IDDireccion', idDireccion)]),
};
