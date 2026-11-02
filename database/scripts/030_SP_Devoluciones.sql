/* =============================================================================
   ShopCart · 030 · SPs de devoluciones
   -----------------------------------------------------------------------------
   Las registra el operador o el administrador cuando recibe el producto.
   - Pueden ser parciales (algunas unidades de algunas líneas) o totales.
   - Nunca se devuelve más de lo vendido por línea: lo valida el SP con la fila
     bloqueada y además el CHECK CK_PedidoDetalle_Devolucion de la tabla.
   - Reembolso de una línea = parte proporcional de su total (ya con descuento).
     En la última devolución de la línea se reembolsa exactamente lo que falta,
     así la suma de reembolsos nunca se descuadra por redondeo.
   - Si con esta devolución queda devuelto todo el pedido, se reembolsa también
     el envío y el pedido pasa a DEVUELTO; si no, a DEVUELTO_PARCIAL.
   - Las unidades regresan al inventario con un movimiento DEVOLUCION en kardex.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_Registrar
    @IDUsuarioAccion INT,
    @IDPedido        INT,
    @Motivo          NVARCHAR(250),
    @Lineas          dbo.TT_Devoluciones_Linea READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @CodigoEstado VARCHAR(20), @NombreEstado NVARCHAR(50), @CostoEnvio DECIMAL(12,2), @NumeroPedido VARCHAR(20),
            @Completa BIT, @MontoLineas DECIMAL(12,2), @MontoReembolso DECIMAL(12,2), @IDDevolucion INT,
            @Exceso NVARCHAR(1500), @Mensaje NVARCHAR(2000);
    DECLARE @IDTipoDevolucion INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'DEVOLUCION');
    DECLARE @Calculo TABLE (IDPedidoDetalle INT PRIMARY KEY, IDVariante INT, Cantidad INT, Monto DECIMAL(12,2));
    DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

    IF NOT EXISTS (SELECT 1 FROM @Lineas)
        THROW 59004, N'Indica al menos una línea del pedido a devolver.', 1;
    IF EXISTS (SELECT 1 FROM @Lineas WHERE Cantidad <= 0)
        THROW 50001, N'Las cantidades a devolver deben ser mayores a cero.', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) < 3
        THROW 50001, N'Indica el motivo de la devolución.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @CodigoEstado = e.Codigo, @NombreEstado = e.Nombre, @CostoEnvio = p.CostoEnvio, @NumeroPedido = p.NumeroPedido
        FROM dbo.Pedido p WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @CodigoEstado IS NULL
            THROW 58001, N'El pedido no existe.', 1;
        IF @CodigoEstado NOT IN ('ENTREGADO', 'DEVUELTO_PARCIAL')
        BEGIN
            SET @Mensaje = CONCAT(N'Solo se pueden devolver productos de pedidos entregados. Este pedido está "', @NombreEstado, N'".');
            THROW 59001, @Mensaje, 1;
        END;

        IF EXISTS (SELECT 1 FROM @Lineas l
                   WHERE NOT EXISTS (SELECT 1 FROM dbo.PedidoDetalle d
                                     WHERE d.IDPedidoDetalle = l.IDPedidoDetalle AND d.IDPedido = @IDPedido))
            THROW 59003, N'Alguna de las líneas indicadas no pertenece a este pedido.', 1;

        -- No se puede devolver más de lo que queda por devolver en cada línea
        SELECT @Exceso = STRING_AGG(CAST(CONCAT(d.SKU, N': se vendieron ', d.Cantidad, N', ya se devolvieron ',
                                                d.CantidadDevuelta, N', se pueden devolver ', d.Cantidad - d.CantidadDevuelta,
                                                N' y se pidieron ', l.Cantidad) AS NVARCHAR(300)), N'; ')
        FROM @Lineas l
        INNER JOIN dbo.PedidoDetalle d WITH (UPDLOCK, ROWLOCK) ON d.IDPedidoDetalle = l.IDPedidoDetalle
        WHERE l.Cantidad > d.Cantidad - d.CantidadDevuelta;

        IF @Exceso IS NOT NULL
        BEGIN
            SET @Mensaje = CONCAT(N'No se puede devolver más de lo vendido. ', @Exceso, N'.');
            THROW 59002, @Mensaje, 1;
        END;

        -- Reembolso por línea
        INSERT INTO @Calculo (IDPedidoDetalle, IDVariante, Cantidad, Monto)
        SELECT d.IDPedidoDetalle, d.IDVariante, l.Cantidad,
               CASE WHEN d.CantidadDevuelta + l.Cantidad = d.Cantidad
                    THEN d.Total - d.MontoDevuelto
                    ELSE CAST(ROUND(d.Total * l.Cantidad / d.Cantidad, 2) AS DECIMAL(12,2)) END
        FROM @Lineas l
        INNER JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = l.IDPedidoDetalle;

        -- ¿Con esta devolución queda devuelto todo el pedido?
        SET @Completa = CASE WHEN EXISTS (
                            SELECT 1 FROM dbo.PedidoDetalle d
                            LEFT JOIN @Calculo c ON c.IDPedidoDetalle = d.IDPedidoDetalle
                            WHERE d.IDPedido = @IDPedido AND d.CantidadDevuelta + ISNULL(c.Cantidad, 0) < d.Cantidad)
                        THEN 0 ELSE 1 END;

        SELECT @MontoLineas = SUM(Monto) FROM @Calculo;
        SET @MontoReembolso = @MontoLineas + CASE WHEN @Completa = 1 THEN @CostoEnvio ELSE 0 END;

        INSERT INTO dbo.Devolucion (IDPedido, IDUsuario, Motivo, MontoReembolso, IncluyeEnvio, Fecha)
        VALUES (@IDPedido, @IDUsuarioAccion, LTRIM(RTRIM(@Motivo)), @MontoReembolso, @Completa, @Ahora);
        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT INTO dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, MontoReembolso)
        SELECT @IDDevolucion, IDPedidoDetalle, Cantidad, Monto FROM @Calculo;

        UPDATE d
        SET d.CantidadDevuelta = d.CantidadDevuelta + c.Cantidad,
            d.MontoDevuelto = d.MontoDevuelto + c.Monto
        FROM dbo.PedidoDetalle d
        INNER JOIN @Calculo c ON c.IDPedidoDetalle = d.IDPedidoDetalle;

        -- Las unidades regresan al inventario
        UPDATE v
        SET v.Existencia = v.Existencia + c.Cantidad,
            v.FechaActualizacion = @Ahora
        OUTPUT inserted.IDVariante, c.Cantidad, deleted.Existencia, inserted.Existencia
            INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
        FROM dbo.Variante v
        INNER JOIN @Calculo c ON c.IDVariante = v.IDVariante;

        INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva,
                                Motivo, IDPedido, IDDevolucion, IDUsuario, Fecha)
        SELECT IDVariante, @IDTipoDevolucion, Cantidad, Anterior, Nueva,
               LEFT(CONCAT(N'Devolución del pedido ', @NumeroPedido, N': ', LTRIM(RTRIM(@Motivo))), 250),
               @IDPedido, @IDDevolucion, @IDUsuarioAccion, @Ahora
        FROM @Movimientos;

        -- Estado y monto devuelto del pedido (el trigger valida la transición)
        UPDATE p
        SET p.MontoDevuelto = p.MontoDevuelto + @MontoReembolso,
            p.IDEstadoPedido = e.IDEstadoPedido,
            p.ComentarioEstado = LTRIM(RTRIM(@Motivo)),
            p.FechaActualizacion = @Ahora
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido e ON e.Codigo = CASE WHEN @Completa = 1 THEN 'DEVUELTO' ELSE 'DEVUELTO_PARCIAL' END
        WHERE p.IDPedido = @IDPedido;

        -- Reembolso al medio de pago
        UPDATE dbo.Pago
        SET MontoReembolsado = MontoReembolsado + @MontoReembolso,
            Estado = CASE WHEN MontoReembolsado + @MontoReembolso >= Monto THEN 'REEMBOLSADO' ELSE 'REEMBOLSO_PARCIAL' END,
            FechaActualizacion = @Ahora
        WHERE IDPedido = @IDPedido;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT dv.IDDevolucion, dv.IDPedido, NumeroPedido = @NumeroPedido, dv.Motivo, dv.MontoReembolso, dv.IncluyeEnvio,
           dv.Fecha, EstadoPedido = e.Codigo
    FROM dbo.Devolucion dv
    INNER JOIN dbo.Pedido p       ON p.IDPedido = dv.IDPedido
    INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE dv.IDDevolucion = @IDDevolucion;

    SELECT dd.IDPedidoDetalle, pd.SKU, pd.NombreProducto, dd.Cantidad, dd.MontoReembolso
    FROM dbo.DevolucionDetalle dd
    INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = dd.IDPedidoDetalle
    WHERE dd.IDDevolucion = @IDDevolucion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_ListarPorPedido
    @IDPedido INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Pedido WHERE IDPedido = @IDPedido)
        THROW 58001, N'El pedido no existe.', 1;

    SELECT dv.IDDevolucion, dv.Motivo, dv.MontoReembolso, dv.IncluyeEnvio, dv.Fecha,
           RegistradaPor = CONCAT(u.Nombres, N' ', u.Apellidos),
           Lineas = (SELECT dd.IDPedidoDetalle AS idPedidoDetalle, pd.SKU AS sku, pd.NombreProducto AS producto,
                            dd.Cantidad AS cantidad, dd.MontoReembolso AS montoReembolso
                     FROM dbo.DevolucionDetalle dd
                     INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = dd.IDPedidoDetalle
                     WHERE dd.IDDevolucion = dv.IDDevolucion
                     FOR JSON PATH)
    FROM dbo.Devolucion dv
    INNER JOIN dbo.Usuario u ON u.IDUsuario = dv.IDUsuario
    WHERE dv.IDPedido = @IDPedido
    ORDER BY dv.Fecha;
END;
GO
