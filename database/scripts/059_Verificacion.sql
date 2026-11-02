/* =============================================================================
   ShopCart · 059 · Verificación de integridad después de cargar todo
   -----------------------------------------------------------------------------
   Si algo no cuadra, el script lanza un error y la instalación se detiene.
   Lo dejo como parte de la instalación para que cualquiera pueda comprobar que
   las reglas se cumplen con los datos semilla.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

DECLARE @Errores NVARCHAR(2000) = N'';

-- 1. Existencia = suma del kardex = saldo del último movimiento
IF EXISTS (SELECT 1 FROM dbo.VW_Inventario_ConciliacionKardex WHERE Cuadra = 0)
    SET @Errores += N'[Kardex descuadrado] ';

-- 2. Encabezado del pedido = suma de sus líneas
IF EXISTS (SELECT 1 FROM dbo.Pedido p
           CROSS APPLY (SELECT Subtotal = SUM(d.Subtotal), Descuento = SUM(d.Descuento)
                        FROM dbo.PedidoDetalle d WHERE d.IDPedido = p.IDPedido) t
           WHERE p.Subtotal <> t.Subtotal OR p.Descuento <> t.Descuento)
    SET @Errores += N'[Totales de pedido descuadrados] ';

-- 3. Usos del cupón = usos aplicados registrados
IF EXISTS (SELECT 1 FROM dbo.Cupon c
           WHERE c.UsosActuales <> (SELECT COUNT(*) FROM dbo.CuponUso u WHERE u.IDCupon = c.IDCupon AND u.Estado = 'APLICADO'))
    SET @Errores += N'[Usos de cupones descuadrados] ';

-- 4. Un pago por pedido y por el total exacto
IF EXISTS (SELECT 1 FROM dbo.Pedido p LEFT JOIN dbo.Pago g ON g.IDPedido = p.IDPedido WHERE g.IDPago IS NULL OR g.Monto <> p.Total)
    SET @Errores += N'[Pagos descuadrados] ';

-- 5. Lo devuelto en el pedido = suma de sus devoluciones
IF EXISTS (SELECT 1 FROM dbo.Pedido p
           WHERE p.MontoDevuelto <> ISNULL((SELECT SUM(dv.MontoReembolso) FROM dbo.Devolucion dv WHERE dv.IDPedido = p.IDPedido), 0))
    SET @Errores += N'[Devoluciones descuadradas] ';

-- 6. Cada pedido tiene historial y su último estado coincide con el actual
IF EXISTS (SELECT 1 FROM dbo.Pedido p
           OUTER APPLY (SELECT TOP (1) h.IDEstadoNuevo FROM dbo.PedidoHistorialEstado h
                        WHERE h.IDPedido = p.IDPedido ORDER BY h.Fecha DESC, h.IDPedidoHistorialEstado DESC) u
           WHERE u.IDEstadoNuevo IS NULL OR u.IDEstadoNuevo <> p.IDEstadoPedido)
    SET @Errores += N'[Historial de estados inconsistente] ';

-- 7. Sin reservas colgadas al terminar la instalación
IF EXISTS (SELECT 1 FROM dbo.Variante WHERE Reservada <> 0)
    SET @Errores += N'[Hay unidades reservadas sin checkout activo] ';

IF LEN(@Errores) > 0
    THROW 60010, @Errores, 1;

SELECT Verificacion = N'OK: todo cuadra',
       Usuarios    = (SELECT COUNT(*) FROM dbo.Usuario),
       Productos   = (SELECT COUNT(*) FROM dbo.Producto),
       Variantes   = (SELECT COUNT(*) FROM dbo.Variante),
       Pedidos     = (SELECT COUNT(*) FROM dbo.Pedido),
       Movimientos = (SELECT COUNT(*) FROM dbo.Kardex),
       SPs         = (SELECT COUNT(*) FROM sys.procedures);
GO
