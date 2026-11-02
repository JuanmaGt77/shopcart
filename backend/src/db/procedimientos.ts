/**
 * Catálogo de los stored procedures que la API puede ejecutar.
 *
 * El ejecutor solo acepta nombres de esta lista (lo revisa TypeScript al compilar y
 * otra vez en tiempo de ejecución). Ningún nombre de SP sale de lo que manda el
 * usuario y en todo el backend no hay ni una sola consulta SQL escrita a mano.
 *
 * Los SPs internos (SP_Pedidos_ConsultarPorID, SP_Carrito_ResolverCarrito, etc.) no
 * están aquí a propósito: el usuario de la base tiene DENY sobre ellos.
 */
export const SP = {
  Sistema: {
    Salud: 'SP_Sistema_Salud',
    ListarParametros: 'SP_Sistema_ListarParametros',
    ActualizarParametro: 'SP_Sistema_ActualizarParametro',
  },
  Seguridad: {
    ObtenerPerfil: 'SP_Seguridad_ObtenerPerfil',
    RegistrarCliente: 'SP_Seguridad_RegistrarCliente',
    ObtenerUsuarioParaLogin: 'SP_Seguridad_ObtenerUsuarioParaLogin',
    IniciarSesion: 'SP_Seguridad_IniciarSesion',
    RotarTokenRefresco: 'SP_Seguridad_RotarTokenRefresco',
    CerrarSesion: 'SP_Seguridad_CerrarSesion',
    ObtenerEstadoUsuario: 'SP_Seguridad_ObtenerEstadoUsuario',
  },
  Usuarios: {
    Listar: 'SP_Usuarios_Listar',
    Obtener: 'SP_Usuarios_Obtener',
    Crear: 'SP_Usuarios_Crear',
    Actualizar: 'SP_Usuarios_Actualizar',
    CambiarEstado: 'SP_Usuarios_CambiarEstado',
  },
  Catalogo: {
    ListarCategorias: 'SP_Catalogo_ListarCategorias',
    ObtenerCategoria: 'SP_Catalogo_ObtenerCategoria',
    CrearCategoria: 'SP_Catalogo_CrearCategoria',
    ActualizarCategoria: 'SP_Catalogo_ActualizarCategoria',
    CambiarEstadoCategoria: 'SP_Catalogo_CambiarEstadoCategoria',
    EliminarCategoria: 'SP_Catalogo_EliminarCategoria',
    BuscarProductos: 'SP_Catalogo_BuscarProductos',
    ObtenerProducto: 'SP_Catalogo_ObtenerProducto',
    CrearProducto: 'SP_Catalogo_CrearProducto',
    ActualizarProducto: 'SP_Catalogo_ActualizarProducto',
    ReemplazarImagenes: 'SP_Catalogo_ReemplazarImagenes',
    CambiarEstadoProducto: 'SP_Catalogo_CambiarEstadoProducto',
    EliminarProducto: 'SP_Catalogo_EliminarProducto',
    AgregarVariante: 'SP_Catalogo_AgregarVariante',
    ActualizarPrecioVariante: 'SP_Catalogo_ActualizarPrecioVariante',
    CambiarEstadoVariante: 'SP_Catalogo_CambiarEstadoVariante',
    ListarAtributos: 'SP_Catalogo_ListarAtributos',
  },
  Inventario: {
    ListarTiposMovimiento: 'SP_Inventario_ListarTiposMovimiento',
    ListarExistencias: 'SP_Inventario_ListarExistencias',
    RegistrarMovimiento: 'SP_Inventario_RegistrarMovimiento',
    LiberarReservasVencidas: 'SP_Inventario_LiberarReservasVencidas',
    ListarKardex: 'SP_Inventario_ListarKardex',
    Conciliacion: 'SP_Inventario_Conciliacion',
  },
  Direcciones: {
    ListarDepartamentos: 'SP_Direcciones_ListarDepartamentos',
    Listar: 'SP_Direcciones_Listar',
    Obtener: 'SP_Direcciones_Obtener',
    Crear: 'SP_Direcciones_Crear',
    Actualizar: 'SP_Direcciones_Actualizar',
    EstablecerPredeterminada: 'SP_Direcciones_EstablecerPredeterminada',
    Eliminar: 'SP_Direcciones_Eliminar',
  },
  Cupones: {
    Listar: 'SP_Cupones_Listar',
    Obtener: 'SP_Cupones_Obtener',
    Crear: 'SP_Cupones_Crear',
    Actualizar: 'SP_Cupones_Actualizar',
    CambiarEstado: 'SP_Cupones_CambiarEstado',
    Eliminar: 'SP_Cupones_Eliminar',
    ListarUsos: 'SP_Cupones_ListarUsos',
  },
  Carrito: {
    Obtener: 'SP_Carrito_Obtener',
    AgregarProducto: 'SP_Carrito_AgregarProducto',
    ActualizarCantidad: 'SP_Carrito_ActualizarCantidad',
    QuitarProducto: 'SP_Carrito_QuitarProducto',
    Vaciar: 'SP_Carrito_Vaciar',
    AplicarCupon: 'SP_Carrito_AplicarCupon',
    QuitarCupon: 'SP_Carrito_QuitarCupon',
    FusionarInvitado: 'SP_Carrito_FusionarInvitado',
  },
  Checkout: {
    ListarMetodosEnvio: 'SP_Checkout_ListarMetodosEnvio',
    Iniciar: 'SP_Checkout_Iniciar',
    Obtener: 'SP_Checkout_Obtener',
    Cancelar: 'SP_Checkout_Cancelar',
  },
  Pedidos: {
    ListarEstados: 'SP_Pedidos_ListarEstados',
    Obtener: 'SP_Pedidos_Obtener',
    ObtenerPorIdempotencia: 'SP_Pedidos_ObtenerPorIdempotencia',
    CrearPedido: 'SP_Pedidos_CrearPedido',
    ListarMisPedidos: 'SP_Pedidos_ListarMisPedidos',
    Listar: 'SP_Pedidos_Listar',
    CambiarEstado: 'SP_Pedidos_CambiarEstado',
    Cancelar: 'SP_Pedidos_Cancelar',
  },
  Devoluciones: {
    Registrar: 'SP_Devoluciones_Registrar',
    ListarPorPedido: 'SP_Devoluciones_ListarPorPedido',
  },
  Dashboard: {
    Resumen: 'SP_Dashboard_Resumen',
    VentasPorPeriodo: 'SP_Dashboard_VentasPorPeriodo',
    VentasPorCategoria: 'SP_Dashboard_VentasPorCategoria',
    TopProductos: 'SP_Dashboard_TopProductos',
    CarritosAbandonados: 'SP_Dashboard_CarritosAbandonados',
  },
  Bitacora: {
    Listar: 'SP_Bitacora_Listar',
    ResumenModulos: 'SP_Bitacora_ResumenModulos',
  },
} as const;

type Valores<T> = T[keyof T];
type Catalogo = typeof SP;

/** Unión de todos los nombres válidos: 'SP_Sistema_Salud' | 'SP_Seguridad_ObtenerPerfil' | ... */
export type NombreSP = { [M in keyof Catalogo]: Valores<Catalogo[M]> }[keyof Catalogo];

export const SP_PERMITIDOS: ReadonlySet<string> = new Set(
  Object.values(SP).flatMap((modulo) => Object.values(modulo) as string[]),
);
