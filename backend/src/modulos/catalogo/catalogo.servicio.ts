import { ErrorNoEncontrado } from '../../compartido/errores.js';
import { eventosDominio } from '../../compartido/eventos-dominio.js';
import type { UsuarioAutenticado } from '../../compartido/http/tipos.js';
import { catalogoRepositorio, type ProductoDetalle } from './catalogo.repositorio.js';
import type {
  CambiosProducto,
  DatosCategoria,
  FiltroProductos,
  Imagen,
  NuevaVariante,
  NuevoProducto,
} from './catalogo.esquemas.js';

const esPersonal = (usuario: UsuarioAutenticado | null) => usuario?.rol === 'ADMIN' || usuario?.rol === 'OPERADOR';

function productoExistente(detalle: ProductoDetalle | null): ProductoDetalle {
  if (!detalle) throw new ErrorNoEncontrado('El producto no existe.', 'PRODUCTO_NO_ENCONTRADO');
  return detalle;
}

/** La tienda solo muestra lo disponible; existencia física y reservada son datos internos. */
function vistaPublica(detalle: ProductoDetalle) {
  return {
    ...detalle,
    variantes: detalle.variantes.map(({ existencia: _e, reservada: _r, ...publico }) => publico),
  };
}

function avisarExistencias(detalle: ProductoDetalle) {
  eventosDominio.emit(
    'inventario:cambio',
    detalle.variantes.map((v) => ({
      idVariante: v.idVariante,
      idProducto: detalle.idProducto,
      sku: v.sku,
      disponible: v.disponible,
    })),
  );
}

export const catalogoServicio = {
  // --- Categorías
  listarCategorias: (usuario: UsuarioAutenticado | null, incluirInactivas = false) =>
    catalogoRepositorio.listarCategorias(incluirInactivas && esPersonal(usuario)),

  async obtenerCategoria(id: number) {
    const categoria = await catalogoRepositorio.obtenerCategoria(id);
    if (!categoria) throw new ErrorNoEncontrado('La categoría no existe.', 'CATEGORIA_NO_ENCONTRADA');
    return categoria;
  },

  async crearCategoria(idAccion: number, datos: DatosCategoria) {
    const categoria = await catalogoRepositorio.crearCategoria(idAccion, datos);
    if (categoria) eventosDominio.emit('catalogo:cambio', { entidad: 'categoria', id: categoria.idCategoria, accion: 'CREAR' });
    return categoria;
  },

  async actualizarCategoria(idAccion: number, id: number, datos: DatosCategoria) {
    const categoria = await catalogoRepositorio.actualizarCategoria(idAccion, id, datos);
    eventosDominio.emit('catalogo:cambio', { entidad: 'categoria', id, accion: 'MODIFICAR' });
    return categoria;
  },

  async cambiarEstadoCategoria(idAccion: number, id: number, activo: boolean) {
    const categoria = await catalogoRepositorio.cambiarEstadoCategoria(idAccion, id, activo);
    eventosDominio.emit('catalogo:cambio', { entidad: 'categoria', id, accion: activo ? 'ACTIVAR' : 'DESACTIVAR' });
    return categoria;
  },

  async eliminarCategoria(idAccion: number, id: number) {
    const resultado = await catalogoRepositorio.eliminarCategoria(idAccion, id);
    eventosDominio.emit('catalogo:cambio', { entidad: 'categoria', id, accion: 'ELIMINAR' });
    return resultado;
  },

  // --- Productos
  buscarProductos: (filtro: FiltroProductos, usuario: UsuarioAutenticado | null) =>
    catalogoRepositorio.buscarProductos(filtro, (filtro.incluirInactivos ?? false) && esPersonal(usuario)),

  async obtenerProducto(id: number, usuario: UsuarioAutenticado | null) {
    const personal = esPersonal(usuario);
    const detalle = productoExistente(await catalogoRepositorio.obtenerProducto(id, personal));
    return personal ? detalle : vistaPublica(detalle);
  },

  async crearProducto(idAccion: number, datos: NuevoProducto) {
    const detalle = productoExistente(await catalogoRepositorio.crearProducto(idAccion, datos));
    eventosDominio.emit('catalogo:cambio', { entidad: 'producto', id: detalle.idProducto, accion: 'CREAR' });
    avisarExistencias(detalle);
    return detalle;
  },

  async actualizarProducto(idAccion: number, id: number, datos: CambiosProducto) {
    const detalle = productoExistente(await catalogoRepositorio.actualizarProducto(idAccion, id, datos));
    eventosDominio.emit('catalogo:cambio', { entidad: 'producto', id, accion: 'MODIFICAR' });
    return detalle;
  },

  async reemplazarImagenes(idAccion: number, id: number, imagenes: Imagen[]) {
    const detalle = productoExistente(await catalogoRepositorio.reemplazarImagenes(idAccion, id, imagenes));
    eventosDominio.emit('catalogo:cambio', { entidad: 'producto', id, accion: 'MODIFICAR' });
    return detalle;
  },

  async cambiarEstadoProducto(idAccion: number, id: number, activo: boolean) {
    const detalle = productoExistente(await catalogoRepositorio.cambiarEstadoProducto(idAccion, id, activo));
    eventosDominio.emit('catalogo:cambio', { entidad: 'producto', id, accion: activo ? 'ACTIVAR' : 'DESACTIVAR' });
    return detalle;
  },

  /** Si tuvo ventas o movimientos solo se desactiva; el SP decide y avisa cuál de las dos pasó. */
  async eliminarProducto(idAccion: number, id: number) {
    const resultado = await catalogoRepositorio.eliminarProducto(idAccion, id);
    eventosDominio.emit('catalogo:cambio', { entidad: 'producto', id, accion: resultado?.resultado ?? 'ELIMINAR' });
    return {
      ...resultado,
      mensaje:
        resultado?.resultado === 'DESACTIVADO'
          ? 'El producto tiene ventas o movimientos de inventario: no se borró, se desactivó y ya no aparece en la tienda.'
          : 'El producto se eliminó.',
    };
  },

  // --- Variantes
  async agregarVariante(idAccion: number, idProducto: number, datos: NuevaVariante) {
    const detalle = productoExistente(await catalogoRepositorio.agregarVariante(idAccion, idProducto, datos));
    eventosDominio.emit('catalogo:cambio', { entidad: 'variante', id: idProducto, accion: 'CREAR' });
    avisarExistencias(detalle);
    return detalle;
  },

  async actualizarPrecio(idAccion: number, idVariante: number, precio: number) {
    const variante = await catalogoRepositorio.actualizarPrecio(idAccion, idVariante, precio);
    if (!variante) throw new ErrorNoEncontrado('La variante no existe.', 'VARIANTE_NO_ENCONTRADA');
    eventosDominio.emit('catalogo:cambio', { entidad: 'variante', id: idVariante, accion: 'CAMBIO_PRECIO' });
    return variante;
  },

  async cambiarEstadoVariante(idAccion: number, idVariante: number, activo: boolean) {
    const variante = await catalogoRepositorio.cambiarEstadoVariante(idAccion, idVariante, activo);
    if (!variante) throw new ErrorNoEncontrado('La variante no existe.', 'VARIANTE_NO_ENCONTRADA');
    eventosDominio.emit('catalogo:cambio', { entidad: 'variante', id: idVariante, accion: activo ? 'ACTIVAR' : 'DESACTIVAR' });
    return variante;
  },

  listarAtributos: () => catalogoRepositorio.listarAtributos(),
};
