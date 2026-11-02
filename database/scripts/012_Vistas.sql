/* =============================================================================
   ShopCart · 012 · Vistas
   -----------------------------------------------------------------------------
   Vistas que reutilizan los SPs para no repetir los mismos JOIN en todos lados.
   Las de reportes concentran la regla de qué cuenta como venta: solo pedidos
   cuyo estado tiene CuentaComoVenta = 1 (excluye cancelados y devueltos), y
   siempre restando lo devuelto.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Variante con su producto, categoría, descripción y si se puede vender
CREATE OR ALTER VIEW dbo.VW_Catalogo_VarianteDetalle
AS
SELECT
    v.IDVariante,
    v.IDProducto,
    v.SKU,
    v.Precio,
    v.Existencia,
    v.Reservada,
    v.Disponible,
    VarianteActiva      = v.Activo,
    NombreProducto      = p.Nombre,
    ProductoActivo      = p.Activo,
    p.IDCategoria,
    Categoria           = c.Nombre,
    CategoriaActiva     = c.Activo,
    Vendible            = CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1 THEN 1 ELSE 0 END AS BIT),
    DescripcionVariante = d.Descripcion
FROM dbo.Variante v
INNER JOIN dbo.Producto p  ON p.IDProducto = v.IDProducto
INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
OUTER APPLY dbo.FU_Catalogo_DescripcionVariante(v.IDVariante) d;
GO

-- La existencia de cada variante debe ser igual a la suma de su kardex
-- y al saldo del último movimiento. Si todo está bien, Diferencia = 0 en todas.
CREATE OR ALTER VIEW dbo.VW_Inventario_ConciliacionKardex
AS
SELECT
    v.IDVariante,
    v.SKU,
    v.Existencia,
    SumaKardex          = ISNULL(k.Suma, 0),
    Diferencia          = v.Existencia - ISNULL(k.Suma, 0),
    Movimientos         = ISNULL(k.Movimientos, 0),
    SaldoUltimoMovimiento = ISNULL(u.ExistenciaNueva, 0),
    Cuadra              = CAST(CASE WHEN v.Existencia = ISNULL(k.Suma, 0)
                                     AND v.Existencia = ISNULL(u.ExistenciaNueva, 0) THEN 1 ELSE 0 END AS BIT)
FROM dbo.Variante v
OUTER APPLY (
    SELECT Suma = SUM(kx.Cantidad), Movimientos = COUNT(*)
    FROM dbo.Kardex kx
    WHERE kx.IDVariante = v.IDVariante
) k
OUTER APPLY (
    SELECT TOP (1) ku.ExistenciaNueva
    FROM dbo.Kardex ku
    WHERE ku.IDVariante = v.IDVariante
    ORDER BY ku.IDKardex DESC
) u;
GO

-- Encabezado de pedido con cliente y estado (lo usan los listados)
CREATE OR ALTER VIEW dbo.VW_Pedidos_Resumen
AS
SELECT
    p.IDPedido,
    p.NumeroPedido,
    p.IDUsuario,
    Cliente             = CONCAT(u.Nombres, N' ', u.Apellidos),
    CorreoCliente       = u.Correo,
    p.IDEstadoPedido,
    EstadoCodigo        = e.Codigo,
    Estado              = e.Nombre,
    p.Subtotal,
    p.Descuento,
    p.CostoEnvio,
    p.Total,
    p.MontoDevuelto,
    p.CodigoCupon,
    p.MetodoEnvioNombre,
    CantidadArticulos   = (SELECT SUM(d.Cantidad) FROM dbo.PedidoDetalle d WHERE d.IDPedido = p.IDPedido),
    p.FechaCreacion,
    p.FechaActualizacion,
    p.FechaLocal
FROM dbo.Pedido p
INNER JOIN dbo.Usuario u      ON u.IDUsuario = p.IDUsuario
INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido;
GO

-- Historial de estados con nombres legibles y quién hizo cada cambio
CREATE OR ALTER VIEW dbo.VW_Pedidos_Historial
AS
SELECT
    h.IDPedidoHistorialEstado,
    h.IDPedido,
    EstadoAnteriorCodigo    = ea.Codigo,
    EstadoAnterior          = ea.Nombre,
    EstadoNuevoCodigo       = en.Codigo,
    EstadoNuevo             = en.Nombre,
    h.IDUsuario,
    Usuario                 = CASE WHEN u.IDUsuario IS NULL THEN N'Sistema' ELSE CONCAT(u.Nombres, N' ', u.Apellidos) END,
    RolUsuario              = r.Codigo,
    h.Comentario,
    h.Fecha
FROM dbo.PedidoHistorialEstado h
LEFT JOIN dbo.EstadoPedido ea  ON ea.IDEstadoPedido = h.IDEstadoAnterior
INNER JOIN dbo.EstadoPedido en ON en.IDEstadoPedido = h.IDEstadoNuevo
LEFT JOIN dbo.Usuario u        ON u.IDUsuario = h.IDUsuario
LEFT JOIN dbo.Rol r            ON r.IDRol = u.IDRol;
GO

-- Pedidos que cuentan como venta, con su monto neto de devoluciones
CREATE OR ALTER VIEW dbo.VW_Dashboard_VentasPorPedido
AS
SELECT
    p.IDPedido,
    p.FechaLocal,
    p.IDUsuario,
    p.Total,
    p.MontoDevuelto,
    VentaNeta = p.Total - p.MontoDevuelto
FROM dbo.Pedido p
INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
WHERE e.CuentaComoVenta = 1;
GO

-- Líneas vendidas (netas de devoluciones) de pedidos que cuentan como venta
CREATE OR ALTER VIEW dbo.VW_Dashboard_LineasVendidas
AS
SELECT
    p.FechaLocal,
    d.IDPedido,
    d.IDPedidoDetalle,
    d.IDVariante,
    v.IDProducto,
    d.IDCategoria,
    d.SKU,
    d.NombreProducto,
    UnidadesNetas   = d.Cantidad - d.CantidadDevuelta,
    MontoNeto       = d.Total - d.MontoDevuelto
FROM dbo.PedidoDetalle d
INNER JOIN dbo.Pedido p       ON p.IDPedido = d.IDPedido
INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
INNER JOIN dbo.Variante v     ON v.IDVariante = d.IDVariante
WHERE e.CuentaComoVenta = 1;
GO

-- Ventas netas por día y categoría (el SP suma el rango de fechas que se pida)
CREATE OR ALTER VIEW dbo.VW_Dashboard_VentasPorCategoria
AS
SELECT
    l.FechaLocal,
    l.IDCategoria,
    Categoria   = c.Nombre,
    Unidades    = SUM(l.UnidadesNetas),
    Monto       = SUM(l.MontoNeto),
    Pedidos     = COUNT(DISTINCT l.IDPedido)
FROM dbo.VW_Dashboard_LineasVendidas l
INNER JOIN dbo.Categoria c ON c.IDCategoria = l.IDCategoria
GROUP BY l.FechaLocal, l.IDCategoria, c.Nombre;
GO
