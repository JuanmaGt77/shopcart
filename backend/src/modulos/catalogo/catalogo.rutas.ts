import { idEnRuta } from '../../compartido/esquemas.js';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { PERSONAL, SOLO_ADMIN } from '../../compartido/http/tipos.js';
import {
  actualizarProductoEsquema,
  buscarProductosEsquema,
  categoriaEsquema,
  crearProductoEsquema,
  estadoEsquema,
  imagenesEsquema,
  listarCategoriasEsquema,
  precioEsquema,
  varianteEsquema,
} from './catalogo.esquemas.js';
import { catalogoServicio } from './catalogo.servicio.js';

export function rutasCategorias(): Modulo {
  return new Modulo('/api/categorias', 'Catálogo')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Listar categorías',
      descripcion: 'La tienda ve solo las activas. Operador y administrador pueden pedir también las inactivas.',
      acceso: 'opcional',
      query: listarCategoriasEsquema,
      manejador: async ({ query, usuario }) =>
        respuesta(await catalogoServicio.listarCategorias(usuario, query.incluirInactivas)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Ver una categoría',
      acceso: 'publico',
      params: idEnRuta,
      manejador: async ({ params }) => respuesta(await catalogoServicio.obtenerCategoria(params.id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Crear una categoría',
      acceso: SOLO_ADMIN,
      body: categoriaEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(await catalogoServicio.crearCategoria(usuarioDe(ctx).id, ctx.body)),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id',
      resumen: 'Editar una categoría',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: categoriaEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.actualizarCategoria(usuarioDe(ctx).id, ctx.params.id, ctx.body)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/estado',
      resumen: 'Activar o desactivar una categoría',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: estadoEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.cambiarEstadoCategoria(usuarioDe(ctx).id, ctx.params.id, ctx.body.activo)),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/:id',
      resumen: 'Eliminar una categoría',
      descripcion: 'Solo se elimina si nunca tuvo productos ni cupones; si los tuvo responde 409 y hay que desactivarla.',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.eliminarCategoria(usuarioDe(ctx).id, ctx.params.id)),
    });
}

export function rutasProductos(): Modulo {
  return new Modulo('/api/productos', 'Catálogo')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Buscar productos de la tienda',
      descripcion:
        'Búsqueda por texto (nombre, marca, descripción o SKU), filtros por categoría, rango de precio y disponibilidad, con ordenamiento y paginación del lado del servidor.',
      acceso: 'opcional',
      query: buscarProductosEsquema,
      manejador: async ({ query, usuario }) => respuestaPaginada(await catalogoServicio.buscarProductos(query, usuario)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/:id',
      resumen: 'Detalle de un producto con sus variantes e imágenes',
      descripcion: 'El público ve solo lo disponible; el personal ve también existencia física y reservada.',
      acceso: 'opcional',
      params: idEnRuta,
      manejador: async ({ params, usuario }) => respuesta(await catalogoServicio.obtenerProducto(params.id, usuario)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/',
      resumen: 'Crear un producto con sus variantes',
      descripcion:
        'Todo se guarda en una sola transacción. La existencia inicial de cada variante entra al kardex como entrada por compra.',
      acceso: SOLO_ADMIN,
      body: crearProductoEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(await catalogoServicio.crearProducto(usuarioDe(ctx).id, ctx.body)),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id',
      resumen: 'Editar los datos generales de un producto',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: actualizarProductoEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.actualizarProducto(usuarioDe(ctx).id, ctx.params.id, ctx.body)),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:id/imagenes',
      resumen: 'Reemplazar las imágenes de un producto',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: imagenesEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.reemplazarImagenes(usuarioDe(ctx).id, ctx.params.id, ctx.body.imagenes)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/estado',
      resumen: 'Activar o desactivar un producto',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: estadoEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.cambiarEstadoProducto(usuarioDe(ctx).id, ctx.params.id, ctx.body.activo)),
    })
    .ruta({
      metodo: 'delete',
      ruta: '/:id',
      resumen: 'Eliminar un producto (o desactivarlo si ya tiene historia)',
      descripcion:
        'Si el producto tiene ventas o movimientos de inventario no se borra físicamente: se desactiva y deja de mostrarse en la tienda.',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      manejador: async (ctx) => respuesta(await catalogoServicio.eliminarProducto(usuarioDe(ctx).id, ctx.params.id)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/:id/variantes',
      resumen: 'Agregar una variante a un producto',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: varianteEsquema,
      estado: 201,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.agregarVariante(usuarioDe(ctx).id, ctx.params.id, ctx.body)),
    });
}

export function rutasVariantes(): Modulo {
  return new Modulo('/api/variantes', 'Catálogo')
    .ruta({
      metodo: 'patch',
      ruta: '/:id/precio',
      resumen: 'Cambiar el precio de una variante',
      descripcion: 'Queda en bitácora el precio anterior y el nuevo. Los pedidos ya hechos no cambian.',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: precioEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.actualizarPrecio(usuarioDe(ctx).id, ctx.params.id, ctx.body.precio)),
    })
    .ruta({
      metodo: 'patch',
      ruta: '/:id/estado',
      resumen: 'Activar o desactivar una variante',
      acceso: SOLO_ADMIN,
      params: idEnRuta,
      body: estadoEsquema,
      manejador: async (ctx) =>
        respuesta(await catalogoServicio.cambiarEstadoVariante(usuarioDe(ctx).id, ctx.params.id, ctx.body.activo)),
    });
}

export function rutasAtributos(): Modulo {
  return new Modulo('/api/atributos', 'Catálogo').ruta({
    metodo: 'get',
    ruta: '/',
    resumen: 'Atributos de variantes y sus valores (Talla, Color...)',
    acceso: PERSONAL,
    manejador: async () => respuesta(await catalogoServicio.listarAtributos()),
  });
}
