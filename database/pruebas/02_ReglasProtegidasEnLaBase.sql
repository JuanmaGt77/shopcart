/* =============================================================================
   Prueba 02 · La base protege las reglas aunque alguien se salte la API
   -----------------------------------------------------------------------------
   Cada intento hace algo prohibido DIRECTO sobre las tablas (como si alguien
   entrara con SSMS) y muestra el error con el que la base lo rechaza.
   Al final se revierte todo.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT OFF;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE ShopCart;   -- si le pusiste otro nombre a la base, cámbialo aquí
GO

DECLARE @IDPedido INT = (SELECT TOP (1) p.IDPedido FROM dbo.Pedido p
                         INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
                         WHERE e.Codigo = 'ENTREGADO' ORDER BY p.IDPedido);
DECLARE @IDPagado INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'PAGADO');
DECLARE @IDVariante INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = 'PLABAS-NEG-M');

PRINT '--- 1. Transición de estado no permitida (ENTREGADO -> PAGADO) con un UPDATE directo';
BEGIN TRY
    UPDATE dbo.Pedido SET IDEstadoPedido = @IDPagado WHERE IDPedido = @IDPedido;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    IF @@TRANCOUNT > 0 ROLLBACK;
END CATCH;

PRINT '--- 2. Sobreventa: reservar más de lo que existe';
BEGIN TRY
    UPDATE dbo.Variante SET Reservada = Existencia + 1 WHERE IDVariante = @IDVariante;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 3. Existencia negativa';
BEGIN TRY
    UPDATE dbo.Variante SET Existencia = -1 WHERE IDVariante = @IDVariante;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 4. Un movimiento de kardex cuyo saldo no cuadra';
BEGIN TRY
    INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo)
    VALUES (@IDVariante, 1, 5, 10, 20, N'saldo inventado');
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 5. Devolver más unidades de las vendidas en una línea';
BEGIN TRY
    UPDATE dbo.PedidoDetalle SET CantidadDevuelta = Cantidad + 1 WHERE IDPedido = @IDPedido;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 6. Un descuento que deja el total negativo';
BEGIN TRY
    UPDATE dbo.Pedido SET Descuento = Subtotal + 1, Total = CostoEnvio - 1 WHERE IDPedido = @IDPedido;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 7. Segundo pago para el mismo pedido (doble cobro)';
BEGIN TRY
    INSERT INTO dbo.Pago (IDPedido, CodigoAutorizacion, Monto) SELECT IDPedido, 'DOBLE', Total FROM dbo.Pedido WHERE IDPedido = @IDPedido;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 8. Modificar o borrar la bitácora';
BEGIN TRY
    DELETE FROM dbo.Bitacora;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    IF @@TRANCOUNT > 0 ROLLBACK;
END CATCH;

PRINT '--- 9. Modificar el kardex';
BEGIN TRY
    UPDATE dbo.Kardex SET Cantidad = Cantidad WHERE IDVariante = @IDVariante;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    IF @@TRANCOUNT > 0 ROLLBACK;
END CATCH;

PRINT '--- 10. Borrar el historial de estados de un pedido';
BEGIN TRY
    DELETE FROM dbo.PedidoHistorialEstado WHERE IDPedido = @IDPedido;
    PRINT 'ERROR: la base lo permitió';
END TRY
BEGIN CATCH
    PRINT CONCAT('Rechazado por la base (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    IF @@TRANCOUNT > 0 ROLLBACK;
END CATCH;
GO
