/* =============================================================================
   ShopCart · 009 · Índices de rendimiento
   -----------------------------------------------------------------------------
   Los índices que protegen reglas de negocio (UNIQUE y únicos filtrados) están
   junto a cada tabla. Aquí van los índices pensados para las consultas que hace
   cada SP. Al lado de cada uno anoto qué consulta atiende.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Seguridad ----------------------------------------------------------------
-- Revocar todos los tokens de una familia cuando se detecta reuso
CREATE INDEX IX_TokenRefresco_Familia ON dbo.TokenRefresco (Familia);
-- Revocar los tokens vigentes de un usuario al desactivarlo
CREATE INDEX IX_TokenRefresco_Usuario ON dbo.TokenRefresco (IDUsuario) WHERE FechaRevocacion IS NULL;
-- Listado de usuarios por rol
CREATE INDEX IX_Usuario_Rol ON dbo.Usuario (IDRol, Activo);
GO

-- Catálogo -----------------------------------------------------------------
-- Búsqueda de la tienda por categoría (SP_Catalogo_BuscarProductos)
CREATE INDEX IX_Producto_Categoria ON dbo.Producto (IDCategoria, Activo) INCLUDE (Nombre, FechaCreacion);
-- Precio mínimo/máximo y disponibilidad de cada producto
CREATE INDEX IX_Variante_Producto ON dbo.Variante (IDProducto)
    INCLUDE (SKU, Precio, Existencia, Reservada, Activo);
GO

-- Clientes -------------------------------------------------------------------
CREATE INDEX IX_Direccion_Usuario ON dbo.Direccion (IDUsuario, Activo);
GO

-- Carrito y checkout ---------------------------------------------------------
-- Reporte de carritos abandonados (activos sin actividad reciente)
CREATE INDEX IX_Carrito_Actividad ON dbo.Carrito (Estado, FechaUltimaActividad) INCLUDE (IDUsuario);
-- Job que libera reservas vencidas
CREATE INDEX IX_Checkout_Expiracion ON dbo.Checkout (FechaExpiracion) WHERE Estado = 'ACTIVO';
CREATE INDEX IX_Checkout_Carrito ON dbo.Checkout (IDCarrito);
CREATE INDEX IX_Checkout_Usuario ON dbo.Checkout (IDUsuario);
GO

-- Pedidos ----------------------------------------------------------------------
-- "Mis pedidos" del cliente
CREATE INDEX IX_Pedido_Usuario ON dbo.Pedido (IDUsuario, FechaCreacion DESC) INCLUDE (IDEstadoPedido, Total);
-- Listado del operador filtrado por estado y fechas
CREATE INDEX IX_Pedido_Estado_Fecha ON dbo.Pedido (IDEstadoPedido, FechaCreacion DESC);
CREATE INDEX IX_Pedido_Fecha ON dbo.Pedido (FechaCreacion DESC) INCLUDE (IDEstadoPedido, IDUsuario, Total);
-- Reportes por día/semana/mes
CREATE INDEX IX_Pedido_FechaLocal ON dbo.Pedido (FechaLocal) INCLUDE (IDEstadoPedido, Total, MontoDevuelto);
-- Reportes por categoría y top de productos (índice que cubre la consulta)
CREATE INDEX IX_PedidoDetalle_Reportes ON dbo.PedidoDetalle (IDPedido)
    INCLUDE (IDVariante, IDCategoria, Cantidad, CantidadDevuelta, Total, MontoDevuelto);
-- Saber si una variante ya tiene ventas (para decidir si se borra o se desactiva)
CREATE INDEX IX_PedidoDetalle_Variante ON dbo.PedidoDetalle (IDVariante);
CREATE INDEX IX_PedidoHistorialEstado_Pedido ON dbo.PedidoHistorialEstado (IDPedido, Fecha);
CREATE INDEX IX_Devolucion_Pedido ON dbo.Devolucion (IDPedido);
CREATE INDEX IX_DevolucionDetalle_PedidoDetalle ON dbo.DevolucionDetalle (IDPedidoDetalle);
-- Límite de usos por cliente de un cupón
CREATE INDEX IX_CuponUso_CuponUsuario ON dbo.CuponUso (IDCupon, IDUsuario) WHERE Estado = 'APLICADO';
GO

-- Inventario -------------------------------------------------------------------
-- Kardex de una variante ordenado por fecha
CREATE INDEX IX_Kardex_Variante_Fecha ON dbo.Kardex (IDVariante, Fecha DESC) INCLUDE (IDTipoMovimiento, Cantidad);
CREATE INDEX IX_Kardex_Pedido ON dbo.Kardex (IDPedido) WHERE IDPedido IS NOT NULL;
GO

-- Bitácora ---------------------------------------------------------------------
CREATE INDEX IX_Bitacora_Modulo_Fecha ON dbo.Bitacora (Modulo, Fecha DESC);
CREATE INDEX IX_Bitacora_Entidad ON dbo.Bitacora (Entidad, IDEntidad);
CREATE INDEX IX_Bitacora_Fecha ON dbo.Bitacora (Fecha DESC);
GO
