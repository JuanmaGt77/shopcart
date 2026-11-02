import { consultarLista, consultarPaginado, consultarUno, ejecutarSP, parsearJson, type Fila } from '../../db/ejecutor.js';
import { p } from '../../db/parametros.js';
import { SP } from '../../db/procedimientos.js';
import { tablaAtributos, tablaImagenes, tablaVariantes } from '../../db/tablas.js';
import type {
  CambiosProducto,
  DatosCategoria,
  FiltroProductos,
  Imagen,
  NuevaVariante,
  NuevoProducto,
} from './catalogo.esquemas.js';

export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  productosActivos: number;
}

export interface ProductoResumen {
  idProducto: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  activo: boolean;
  precioMinimo: number | null;
  precioMaximo: number | null;
  disponible: number;
  imagenUrl: string | null;
}

export interface VarianteDetalle {
  idVariante: number;
  sku: string;
  precio: number;
  existencia: number;
  reservada: number;
  disponible: number;
  activo: boolean;
  descripcionVariante: string | null;
  atributos: { nombre: string; valor: string }[];
}

export interface ProductoDetalle extends Fila {
  idProducto: number;
  nombre: string;
  variantes: VarianteDetalle[];
  imagenes: Fila[];
}

const ORDEN: Record<FiltroProductos['ordenarPor'], string> = {
  nombre: 'NOMBRE',
  precio: 'PRECIO',
  recientes: 'RECIENTES',
};

function armarDetalle(conjuntos: Fila[][]): ProductoDetalle | null {
  const [productos = [], variantes = [], imagenes = []] = conjuntos;
  const producto = productos[0];
  if (!producto) return null;
  return {
    ...producto,
    variantes: variantes.map((v) => ({
      ...(v as unknown as VarianteDetalle),
      atributos: parsearJson<{ nombre: string; valor: string }>(v.atributos),
    })),
    imagenes,
  } as ProductoDetalle;
}

function filasDeAtributos(clave: number, atributos: Record<string, string>) {
  return Object.entries(atributos).map(([atributo, valor]) => ({ claveVariante: clave, atributo, valor }));
}

function filasDeImagenes(imagenes: Imagen[]) {
  return imagenes.map((imagen, indice) => ({ orden: indice, url: imagen.url, textoAlternativo: imagen.textoAlternativo }));
}

export const catalogoRepositorio = {
  // --- Categorías
  listarCategorias: (incluirInactivas: boolean) =>
    consultarLista<Categoria>(SP.Catalogo.ListarCategorias, [p.bit('IncluirInactivas', incluirInactivas)]),

  obtenerCategoria: (id: number) =>
    consultarUno<Categoria>(SP.Catalogo.ObtenerCategoria, [p.entero('IDCategoria', id)]),

  crearCategoria: (idAccion: number, datos: DatosCategoria) =>
    consultarUno<Categoria>(SP.Catalogo.CrearCategoria, [
      p.entero('IDUsuarioAccion', idAccion),
      p.texto('Nombre', 100, datos.nombre),
      p.texto('Descripcion', 500, datos.descripcion),
    ]),

  actualizarCategoria: (idAccion: number, id: number, datos: DatosCategoria) =>
    consultarUno<Categoria>(SP.Catalogo.ActualizarCategoria, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCategoria', id),
      p.texto('Nombre', 100, datos.nombre),
      p.texto('Descripcion', 500, datos.descripcion),
    ]),

  cambiarEstadoCategoria: (idAccion: number, id: number, activo: boolean) =>
    consultarUno<Categoria>(SP.Catalogo.CambiarEstadoCategoria, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCategoria', id),
      p.bit('Activo', activo),
    ]),

  eliminarCategoria: (idAccion: number, id: number) =>
    consultarUno<{ resultado: string; idCategoria: number }>(SP.Catalogo.EliminarCategoria, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDCategoria', id),
    ]),

  // --- Productos
  buscarProductos: (f: FiltroProductos, incluirInactivos: boolean) =>
    consultarPaginado<ProductoResumen>(
      SP.Catalogo.BuscarProductos,
      [
        p.texto('Texto', 100, f.q),
        p.entero('IDCategoria', f.idCategoria),
        p.dinero('PrecioMin', f.precioMin),
        p.dinero('PrecioMax', f.precioMax),
        p.bit('SoloDisponibles', f.disponible ?? false),
        p.ascii('OrdenarPor', 12, ORDEN[f.ordenarPor]),
        p.ascii('Direccion', 4, f.direccion.toUpperCase()),
        p.entero('Pagina', f.pagina),
        p.entero('TamanoPagina', f.tamanoPagina),
        p.bit('IncluirInactivos', incluirInactivos),
      ],
      f.pagina,
      f.tamanoPagina,
    ),

  async obtenerProducto(id: number, incluirInactivos: boolean) {
    return armarDetalle(
      await ejecutarSP(SP.Catalogo.ObtenerProducto, [p.entero('IDProducto', id), p.bit('IncluirInactivos', incluirInactivos)]),
    );
  },

  async crearProducto(idAccion: number, datos: NuevoProducto) {
    const variantes = datos.variantes.map((v, i) => ({
      clave: i + 1,
      sku: v.sku,
      precio: v.precio,
      existenciaInicial: v.existenciaInicial,
    }));
    const atributos = datos.variantes.flatMap((v, i) => filasDeAtributos(i + 1, v.atributos));

    return armarDetalle(
      await ejecutarSP(SP.Catalogo.CrearProducto, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDCategoria', datos.idCategoria),
        p.texto('Nombre', 150, datos.nombre),
        p.texto('Descripcion', 2000, datos.descripcion),
        p.texto('Marca', 80, datos.marca),
        p.tabla('Imagenes', tablaImagenes(filasDeImagenes(datos.imagenes))),
        p.tabla('Variantes', tablaVariantes(variantes)),
        p.tabla('Atributos', tablaAtributos(atributos)),
      ]),
    );
  },

  async actualizarProducto(idAccion: number, id: number, datos: CambiosProducto) {
    return armarDetalle(
      await ejecutarSP(SP.Catalogo.ActualizarProducto, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDProducto', id),
        p.entero('IDCategoria', datos.idCategoria),
        p.texto('Nombre', 150, datos.nombre),
        p.texto('Descripcion', 2000, datos.descripcion),
        p.texto('Marca', 80, datos.marca),
      ]),
    );
  },

  async reemplazarImagenes(idAccion: number, id: number, imagenes: Imagen[]) {
    return armarDetalle(
      await ejecutarSP(SP.Catalogo.ReemplazarImagenes, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDProducto', id),
        p.tabla('Imagenes', tablaImagenes(filasDeImagenes(imagenes))),
      ]),
    );
  },

  async cambiarEstadoProducto(idAccion: number, id: number, activo: boolean) {
    return armarDetalle(
      await ejecutarSP(SP.Catalogo.CambiarEstadoProducto, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDProducto', id),
        p.bit('Activo', activo),
      ]),
    );
  },

  eliminarProducto: (idAccion: number, id: number) =>
    consultarUno<{ resultado: 'ELIMINADO' | 'DESACTIVADO'; idProducto: number }>(SP.Catalogo.EliminarProducto, [
      p.entero('IDUsuarioAccion', idAccion),
      p.entero('IDProducto', id),
    ]),

  // --- Variantes
  async agregarVariante(idAccion: number, idProducto: number, datos: NuevaVariante) {
    return armarDetalle(
      await ejecutarSP(SP.Catalogo.AgregarVariante, [
        p.entero('IDUsuarioAccion', idAccion),
        p.entero('IDProducto', idProducto),
        p.ascii('SKU', 40, datos.sku),
        p.dinero('Precio', datos.precio),
        p.entero('ExistenciaInicial', datos.existenciaInicial),
        p.tabla('Atributos', tablaAtributos(filasDeAtributos(1, datos.atributos))),
      ]),
    );
  },

  actualizarPrecio: (idAccion: number, idVariante: number, precio: number) =>
    consultarUno<Fila & { idVariante: number; idProducto: number; sku: string; disponible: number }>(
      SP.Catalogo.ActualizarPrecioVariante,
      [p.entero('IDUsuarioAccion', idAccion), p.entero('IDVariante', idVariante), p.dinero('Precio', precio)],
    ),

  cambiarEstadoVariante: (idAccion: number, idVariante: number, activo: boolean) =>
    consultarUno<Fila & { idVariante: number; idProducto: number; sku: string; disponible: number }>(
      SP.Catalogo.CambiarEstadoVariante,
      [p.entero('IDUsuarioAccion', idAccion), p.entero('IDVariante', idVariante), p.bit('Activo', activo)],
    ),

  async listarAtributos() {
    const filas = await consultarLista<Fila>(SP.Catalogo.ListarAtributos);
    return filas.map((f) => ({ ...f, valores: parsearJson<{ id: number; valor: string }>(f.valores) }));
  },
};
