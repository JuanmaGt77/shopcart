/* =============================================================================
   ShopCart · 054 · Datos semilla: pedidos de los últimos 90 días
   -----------------------------------------------------------------------------
   Genera unos 320 pedidos con fechas relativas al día en que se corre el script,
   para que el dashboard siempre tenga datos recientes. Es determinístico (no usa
   NEWID ni RAND): cada vez que se corre sale lo mismo, solo corrido en fechas.

   Para que el kardex quede en orden cronológico, primero armo una línea de
   tiempo de eventos (ventas, cancelaciones y devoluciones) y la proceso en orden
   de fecha. Cada evento deja todo lo que dejaría el sistema real: carrito,
   checkout, pedido, detalle, kardex, uso de cupón, pago, historial y devolución.

   El trigger de estados se apaga solo durante la carga porque necesito fechas
   pasadas en el historial; el historial se inserta aquí mismo con su fecha real.
   Al final, el script 059 verifica que todo cuadre.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

DISABLE TRIGGER dbo.TR_Pedido_Estado ON dbo.Pedido;
DISABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
DISABLE TRIGGER dbo.TR_Cupon_Bitacora ON dbo.Cupon;
GO

SET XACT_ABORT ON;

DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
DECLARE @HoyLocal DATE = CAST(DATEADD(HOUR, -6, @Ahora) AS DATE);
DECLARE @TotalPedidos INT = 320;

DECLARE @EstPagado INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'PAGADO');
DECLARE @EstPrep   INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'EN_PREPARACION');
DECLARE @EstDesp   INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'DESPACHADO');
DECLARE @EstEnt    INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'ENTREGADO');
DECLARE @EstDevP   INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'DEVUELTO_PARCIAL');
DECLARE @EstDev    INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'DEVUELTO');
DECLARE @EstCanc   INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'CANCELADO');
DECLARE @TipoVenta INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'SALIDA_VENTA');
DECLARE @TipoCanc  INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'CANCELACION');
DECLARE @TipoDev   INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'DEVOLUCION');
DECLARE @IDOperador INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'operador@shopcart.test');
DECLARE @IDBienvenida INT = (SELECT IDCupon FROM dbo.Cupon WHERE Codigo = 'BIENVENIDA10');
DECLARE @IDAhorra     INT = (SELECT IDCupon FROM dbo.Cupon WHERE Codigo = 'AHORRA50');
DECLARE @IDAgotado    INT = (SELECT IDCupon FROM dbo.Cupon WHERE Codigo = 'AGOTADO5');

DECLARE @Clientes TABLE (Num INT PRIMARY KEY, IDUsuario INT, IDDireccion INT);
INSERT INTO @Clientes (Num, IDUsuario, IDDireccion)
SELECT ROW_NUMBER() OVER (ORDER BY u.IDUsuario) - 1, u.IDUsuario, d.IDDireccion
FROM dbo.Usuario u
INNER JOIN dbo.Rol r       ON r.IDRol = u.IDRol AND r.Codigo = 'CLIENTE'
INNER JOIN dbo.Direccion d ON d.IDUsuario = u.IDUsuario AND d.EsPredeterminada = 1;
DECLARE @NumClientes INT = (SELECT COUNT(*) FROM @Clientes);

DECLARE @Vars TABLE (Num INT PRIMARY KEY, IDVariante INT);
INSERT INTO @Vars (Num, IDVariante)
SELECT ROW_NUMBER() OVER (ORDER BY v.IDVariante) - 1, v.IDVariante
FROM dbo.Variante v
INNER JOIN dbo.Producto p ON p.IDProducto = v.IDProducto
WHERE v.Activo = 1 AND p.Activo = 1 AND v.Existencia > 10;
DECLARE @NumVars INT = (SELECT COUNT(*) FROM @Vars);

/* 1. Plan de pedidos ---------------------------------------------------------- */
DECLARE @Plan TABLE (
    N INT PRIMARY KEY, Fecha DATETIME2(3), DiasAtras INT, Cliente INT, Envio VARCHAR(20),
    Destino VARCHAR(20), IDPedido INT NULL
);

WITH Numeros AS (
    SELECT TOP (@TotalPedidos) N = ROW_NUMBER() OVER (ORDER BY (SELECT NULL))
    FROM sys.all_columns
),
Base AS (
    SELECT N,
           DiasAtras = CAST(89 * POWER(((N * 7919) % 1000) / 1000.0, 2) AS INT),
           MinutoLocal = 480 + (N * 389) % 780
    FROM Numeros
)
INSERT INTO @Plan (N, Fecha, DiasAtras, Cliente, Envio, Destino)
SELECT N,
       Fecha = CASE WHEN f.FechaUtc >= @Ahora THEN DATEADD(MINUTE, -(15 + N % 240), @Ahora) ELSE f.FechaUtc END,
       DiasAtras,
       Cliente = CASE WHEN N % 9 = 0 THEN 0 ELSE 1 + (N * 13) % (@NumClientes - 1) END,
       Envio = CASE WHEN N % 10 < 6 THEN 'ESTANDAR' WHEN N % 10 < 9 THEN 'EXPRESS' ELSE 'TIENDA' END,
       Destino = CASE WHEN N % 17 = 3 THEN 'CANCELADO'
                      WHEN N % 31 = 7 AND DiasAtras >= 12 THEN 'DEVUELTO'
                      WHEN N % 13 = 5 AND DiasAtras >= 12 THEN 'DEVUELTO_PARCIAL'
                      ELSE 'NORMAL' END
FROM Base
CROSS APPLY (SELECT FechaUtc = DATEADD(MINUTE, MinutoLocal + 360,
                                       CAST(DATEADD(DAY, -DiasAtras, @HoyLocal) AS DATETIME2(3)))) f;

/* 2. Línea de tiempo de eventos ------------------------------------------------- */
DECLARE @Eventos TABLE (ID INT IDENTITY(1,1) PRIMARY KEY, Fecha DATETIME2(3), Tipo VARCHAR(12), N INT);

INSERT INTO @Eventos (Fecha, Tipo, N)
SELECT Fecha, 'VENTA', N FROM @Plan
UNION ALL
SELECT DATEADD(MINUTE, CASE WHEN N % 2 = 0 THEN 180 ELSE 90 END, Fecha), 'CANCELACION', N
FROM @Plan WHERE Destino = 'CANCELADO' AND DATEADD(MINUTE, 180, Fecha) < @Ahora
UNION ALL
SELECT DATEADD(DAY, 7, Fecha), 'DEVOLUCION', N
FROM @Plan WHERE Destino IN ('DEVUELTO', 'DEVUELTO_PARCIAL');

/* 3. Proceso en orden cronológico ------------------------------------------------ */
DECLARE @Fecha DATETIME2(3), @Tipo VARCHAR(12), @N INT;
DECLARE @IDUsuario INT, @IDDireccion INT, @Envio VARCHAR(20), @Destino VARCHAR(20), @IDMetodoEnvio INT,
        @CostoEnvio DECIMAL(12,2), @Subtotal DECIMAL(12,2), @Descuento DECIMAL(12,2), @Total DECIMAL(12,2),
        @IDCupon INT, @CodigoCupon VARCHAR(30), @IDCarrito INT, @IDCheckout INT, @IDPedido INT, @Numero VARCHAR(20),
        @EstadoActual INT, @Paso DATETIME2(3), @Lento INT, @IDDevolucion INT, @Completa BIT,
        @MontoLineas DECIMAL(12,2), @Reembolso DECIMAL(12,2), @Motivo NVARCHAR(250), @IDQuien INT, @TieneCancelacion BIT;

DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT, Precio DECIMAL(12,2), Subtotal DECIMAL(12,2), Descuento DECIMAL(12,2));
DECLARE @Mov TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);
DECLARE @Dev TABLE (IDPedidoDetalle INT PRIMARY KEY, IDVariante INT, Cantidad INT, Monto DECIMAL(12,2));

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE cEventos CURSOR LOCAL FAST_FORWARD FOR
        SELECT Fecha, Tipo, N FROM @Eventos
        ORDER BY Fecha, CASE Tipo WHEN 'VENTA' THEN 0 WHEN 'CANCELACION' THEN 1 ELSE 2 END, N;

    OPEN cEventos;
    FETCH NEXT FROM cEventos INTO @Fecha, @Tipo, @N;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @Tipo = 'VENTA'
        BEGIN
            SELECT @IDUsuario = c.IDUsuario, @IDDireccion = c.IDDireccion, @Envio = p.Envio, @Destino = p.Destino
            FROM @Plan p INNER JOIN @Clientes c ON c.Num = p.Cliente
            WHERE p.N = @N;

            SELECT @IDMetodoEnvio = IDMetodoEnvio, @CostoEnvio = Costo FROM dbo.MetodoEnvio WHERE Codigo = @Envio;

            -- De 1 a 3 productos distintos, con existencia suficiente
            DELETE FROM @Lineas;
            INSERT INTO @Lineas (IDVariante, Cantidad, Precio, Subtotal, Descuento)
            SELECT x.IDVariante, MAX(q.Cantidad), MAX(x.Precio), MAX(q.Cantidad) * MAX(x.Precio), 0
            FROM (VALUES (0), (1), (2)) AS k (k)
            INNER JOIN @Vars v ON v.Num = (@N * 31 + k.k * 97) % @NumVars
            INNER JOIN dbo.Variante x ON x.IDVariante = v.IDVariante
            CROSS APPLY (SELECT Cantidad = CASE WHEN (@N + k.k) % 4 = 0 THEN 2 ELSE 1 END) q
            WHERE k.k < 1 + (@N % 3) AND x.Existencia >= 3
            GROUP BY x.IDVariante;

            IF EXISTS (SELECT 1 FROM @Lineas)
            BEGIN
                SELECT @Subtotal = SUM(Subtotal) FROM @Lineas;

                -- Cupón (solo algunos pedidos, respetando sus reglas)
                SET @IDCupon = NULL;
                IF @N % 9 = 4 AND @Subtotal >= 100
                   AND NOT EXISTS (SELECT 1 FROM dbo.CuponUso WHERE IDCupon = @IDBienvenida AND IDUsuario = @IDUsuario AND Estado = 'APLICADO')
                    SET @IDCupon = @IDBienvenida;
                ELSE IF @N % 11 = 6 AND @Subtotal >= 300
                    SET @IDCupon = @IDAhorra;
                ELSE IF @N % 7 = 2 AND (SELECT UsosActuales FROM dbo.Cupon WHERE IDCupon = @IDAgotado) < 5
                     AND @Fecha >= (SELECT FechaInicio FROM dbo.Cupon WHERE IDCupon = @IDAgotado)
                    SET @IDCupon = @IDAgotado;

                SET @Descuento = 0;
                SET @CodigoCupon = NULL;
                IF @IDCupon IS NOT NULL
                BEGIN
                    SELECT @Descuento = d.Descuento, @CodigoCupon = c.Codigo
                    FROM dbo.Cupon c
                    CROSS APPLY dbo.FU_Cupones_CalculoDescuento(c.TipoDescuento, c.Valor, c.DescuentoMaximo, @Subtotal) d
                    WHERE c.IDCupon = @IDCupon;

                    -- Reparto del descuento igual que en SP_Checkout_Iniciar
                    WITH Prorrateo AS (
                        SELECT IDVariante, Base = CAST(ROUND(@Descuento * Subtotal / @Subtotal, 2, 1) AS DECIMAL(12,2)),
                               Orden = ROW_NUMBER() OVER (ORDER BY Subtotal DESC, IDVariante)
                        FROM @Lineas
                    ),
                    Final AS (
                        SELECT IDVariante, Monto = Base + CASE WHEN Orden = 1 THEN @Descuento - SUM(Base) OVER () ELSE 0 END
                        FROM Prorrateo
                    )
                    UPDATE l SET l.Descuento = f.Monto
                    FROM @Lineas l INNER JOIN Final f ON f.IDVariante = l.IDVariante;
                END;

                SET @Total = @Subtotal - @Descuento + @CostoEnvio;

                -- Carrito y checkout que originaron el pedido
                INSERT INTO dbo.Carrito (IDUsuario, IDCupon, Estado, FechaCreacion, FechaUltimaActividad, FechaCierre)
                VALUES (@IDUsuario, @IDCupon, 'CONVERTIDO', DATEADD(MINUTE, -25, @Fecha), @Fecha, @Fecha);
                SET @IDCarrito = SCOPE_IDENTITY();

                INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad, FechaAgregado)
                SELECT @IDCarrito, IDVariante, Cantidad, DATEADD(MINUTE, -25, @Fecha) FROM @Lineas;

                INSERT INTO dbo.Checkout (IDCarrito, IDUsuario, IDDireccion, IDMetodoEnvio, IDCupon, Subtotal, Descuento,
                                          CostoEnvio, Total, Estado, FechaCreacion, FechaExpiracion, FechaCierre)
                VALUES (@IDCarrito, @IDUsuario, @IDDireccion, @IDMetodoEnvio, @IDCupon, @Subtotal, @Descuento,
                        @CostoEnvio, @Total, 'COMPLETADO', DATEADD(MINUTE, -4, @Fecha), DATEADD(MINUTE, 11, @Fecha), @Fecha);
                SET @IDCheckout = SCOPE_IDENTITY();

                INSERT INTO dbo.CheckoutDetalle (IDCheckout, IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento)
                SELECT @IDCheckout, IDVariante, Cantidad, Precio, Subtotal, Descuento FROM @Lineas;

                -- Pedido
                INSERT INTO dbo.Pedido (IDUsuario, IDCheckout, IDEstadoPedido, IDMetodoEnvio, IDDireccion, IDCupon,
                                        EntregaDestinatario, EntregaTelefono, EntregaDireccion, MetodoEnvioNombre, CodigoCupon,
                                        Subtotal, Descuento, CostoEnvio, Total, BaseImponible, MontoIVA, ComentarioEstado,
                                        ClaveIdempotencia, FechaCreacion, FechaActualizacion)
                SELECT @IDUsuario, @IDCheckout, @EstPagado, @IDMetodoEnvio, @IDDireccion, @IDCupon,
                       dir.NombreDestinatario, dir.Telefono, dir.Texto, me.Nombre, @CodigoCupon,
                       @Subtotal, @Descuento, @CostoEnvio, @Total, iva.BaseImponible, iva.MontoIVA, N'Pago aprobado',
                       CONCAT('semilla-', RIGHT(CONCAT('0000', @N), 4)), @Fecha, @Fecha
                FROM dbo.FU_Direcciones_TextoEntrega(@IDDireccion) dir
                INNER JOIN dbo.MetodoEnvio me ON me.IDMetodoEnvio = @IDMetodoEnvio
                CROSS APPLY dbo.FU_Pedidos_DesgloseIVA(@Total) iva;
                SET @IDPedido = SCOPE_IDENTITY();
                SELECT @Numero = NumeroPedido FROM dbo.Pedido WHERE IDPedido = @IDPedido;
                UPDATE @Plan SET IDPedido = @IDPedido WHERE N = @N;

                INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, IDCategoria, SKU, NombreProducto, DescripcionVariante,
                                               Cantidad, PrecioUnitario, Subtotal, Descuento, Total)
                SELECT @IDPedido, l.IDVariante, vd.IDCategoria, vd.SKU, vd.NombreProducto, vd.DescripcionVariante,
                       l.Cantidad, l.Precio, l.Subtotal, l.Descuento, l.Subtotal - l.Descuento
                FROM @Lineas l
                INNER JOIN dbo.VW_Catalogo_VarianteDetalle vd ON vd.IDVariante = l.IDVariante;

                -- Salida de inventario
                DELETE FROM @Mov;
                UPDATE v SET v.Existencia = v.Existencia - l.Cantidad
                OUTPUT inserted.IDVariante, l.Cantidad, deleted.Existencia, inserted.Existencia INTO @Mov
                FROM dbo.Variante v INNER JOIN @Lineas l ON l.IDVariante = v.IDVariante;

                INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDPedido, IDUsuario, Fecha)
                SELECT IDVariante, @TipoVenta, -Cantidad, Anterior, Nueva, CONCAT(N'Venta del pedido ', @Numero), @IDPedido, @IDUsuario, @Fecha
                FROM @Mov;

                IF @IDCupon IS NOT NULL
                BEGIN
                    INSERT INTO dbo.CuponUso (IDCupon, IDUsuario, IDPedido, MontoDescuento, FechaUso)
                    VALUES (@IDCupon, @IDUsuario, @IDPedido, @Descuento, @Fecha);
                    UPDATE dbo.Cupon SET UsosActuales = UsosActuales + 1 WHERE IDCupon = @IDCupon;
                END;

                INSERT INTO dbo.Pago (IDPedido, MarcaTarjeta, UltimosDigitos, CodigoAutorizacion, Monto, FechaPago)
                VALUES (@IDPedido, CASE WHEN @N % 3 = 0 THEN 'MASTERCARD' ELSE 'VISA' END,
                        RIGHT(CONCAT('0000', (@N * 37) % 10000), 4),
                        CONCAT('SIM-', RIGHT(CONCAT('000000', (@N * 7349) % 1000000), 6)), @Total, @Fecha);

                -- Historial: nace pagado y avanza según el tiempo que ha pasado
                INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                VALUES (@IDPedido, NULL, @EstPagado, @IDUsuario, N'Pago aprobado', @Fecha);
                SET @EstadoActual = @EstPagado;
                SET @Paso = @Fecha;

                SET @TieneCancelacion = CASE WHEN EXISTS (SELECT 1 FROM @Eventos WHERE N = @N AND Tipo = 'CANCELACION') THEN 1 ELSE 0 END;
                SET @Lento = CASE WHEN @N % 5 = 0 THEN 2 ELSE 1 END;
                -- Algunos pedidos de hoy se quedan en PAGADO para que el operador tenga trabajo pendiente
                IF (SELECT DiasAtras FROM @Plan WHERE N = @N) = 0 AND @N % 2 = 0
                    SET @Lento = 1000;

                IF @TieneCancelacion = 1
                BEGIN
                    IF @N % 2 = 0
                    BEGIN
                        SET @Paso = DATEADD(MINUTE, 60, @Fecha);
                        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                        VALUES (@IDPedido, @EstPagado, @EstPrep, @IDOperador, N'Pedido en preparación', @Paso);
                        SET @EstadoActual = @EstPrep;
                    END;
                END
                ELSE
                BEGIN
                    IF DATEADD(HOUR, 2 * @Lento, @Fecha) < @Ahora
                    BEGIN
                        SET @Paso = DATEADD(HOUR, 2 * @Lento, @Fecha);
                        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                        VALUES (@IDPedido, @EstPagado, @EstPrep, @IDOperador, N'Pedido en preparación', @Paso);
                        SET @EstadoActual = @EstPrep;
                    END;
                    IF @EstadoActual = @EstPrep AND DATEADD(HOUR, 26 * @Lento, @Fecha) < @Ahora
                    BEGIN
                        SET @Paso = DATEADD(HOUR, 26 * @Lento, @Fecha);
                        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                        VALUES (@IDPedido, @EstPrep, @EstDesp, @IDOperador,
                                CASE WHEN @Envio = 'TIENDA' THEN N'Listo para recoger en la estación' ELSE N'Entregado al transportista' END, @Paso);
                        SET @EstadoActual = @EstDesp;
                    END;
                    IF @EstadoActual = @EstDesp AND DATEADD(HOUR, 74 * @Lento, @Fecha) < @Ahora
                    BEGIN
                        SET @Paso = DATEADD(HOUR, 74 * @Lento, @Fecha);
                        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                        VALUES (@IDPedido, @EstDesp, @EstEnt, @IDOperador, N'Entregado al cliente', @Paso);
                        SET @EstadoActual = @EstEnt;
                    END;
                END;

                UPDATE dbo.Pedido
                SET IDEstadoPedido = @EstadoActual,
                    ComentarioEstado = (SELECT TOP (1) Comentario FROM dbo.PedidoHistorialEstado
                                        WHERE IDPedido = @IDPedido ORDER BY Fecha DESC, IDPedidoHistorialEstado DESC),
                    FechaActualizacion = @Paso
                WHERE IDPedido = @IDPedido;
            END;
        END
        ELSE IF @Tipo = 'CANCELACION'
        BEGIN
            SELECT @IDPedido = IDPedido FROM @Plan WHERE N = @N;
            SELECT @EstadoActual = IDEstadoPedido, @IDCupon = IDCupon, @Numero = NumeroPedido, @IDUsuario = IDUsuario
            FROM dbo.Pedido WHERE IDPedido = @IDPedido;

            IF @IDPedido IS NOT NULL AND @EstadoActual IN (@EstPagado, @EstPrep)
            BEGIN
                SET @IDQuien = CASE WHEN @N % 3 = 0 THEN @IDUsuario ELSE @IDOperador END;
                SET @Motivo = CASE WHEN @N % 3 = 0 THEN N'El cliente ya no necesita el producto'
                                   ELSE N'No se pudo confirmar la dirección de entrega' END;

                IF @IDCupon IS NOT NULL
                BEGIN
                    UPDATE dbo.CuponUso SET Estado = 'REVERTIDO', FechaReversion = @Fecha WHERE IDPedido = @IDPedido;
                    UPDATE dbo.Cupon SET UsosActuales = UsosActuales - 1 WHERE IDCupon = @IDCupon;
                END;

                DELETE FROM @Mov;
                UPDATE v SET v.Existencia = v.Existencia + d.Cantidad
                OUTPUT inserted.IDVariante, d.Cantidad, deleted.Existencia, inserted.Existencia INTO @Mov
                FROM dbo.Variante v INNER JOIN dbo.PedidoDetalle d ON d.IDVariante = v.IDVariante
                WHERE d.IDPedido = @IDPedido;

                INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDPedido, IDUsuario, Fecha)
                SELECT IDVariante, @TipoCanc, Cantidad, Anterior, Nueva, CONCAT(N'Cancelación del pedido ', @Numero, N': ', @Motivo),
                       @IDPedido, @IDQuien, @Fecha
                FROM @Mov;

                UPDATE dbo.Pago SET MontoReembolsado = Monto, Estado = 'REEMBOLSADO', FechaActualizacion = @Fecha WHERE IDPedido = @IDPedido;

                INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                VALUES (@IDPedido, @EstadoActual, @EstCanc, @IDQuien, @Motivo, @Fecha);

                UPDATE dbo.Pedido SET IDEstadoPedido = @EstCanc, ComentarioEstado = @Motivo, FechaActualizacion = @Fecha
                WHERE IDPedido = @IDPedido;
            END;
        END
        ELSE
        BEGIN
            -- DEVOLUCION
            SELECT @Destino = Destino, @IDPedido = IDPedido FROM @Plan WHERE N = @N;
            SELECT @EstadoActual = IDEstadoPedido, @CostoEnvio = CostoEnvio, @Numero = NumeroPedido
            FROM dbo.Pedido WHERE IDPedido = @IDPedido;

            IF @IDPedido IS NOT NULL AND @EstadoActual = @EstEnt
            BEGIN
                SET @Motivo = CASE WHEN @N % 2 = 0 THEN N'La talla no le quedó al cliente' ELSE N'El producto llegó con un defecto' END;

                DELETE FROM @Dev;
                INSERT INTO @Dev (IDPedidoDetalle, IDVariante, Cantidad, Monto)
                SELECT d.IDPedidoDetalle, d.IDVariante, x.Cantidad,
                       CASE WHEN d.CantidadDevuelta + x.Cantidad = d.Cantidad THEN d.Total - d.MontoDevuelto
                            ELSE CAST(ROUND(d.Total * x.Cantidad / d.Cantidad, 2) AS DECIMAL(12,2)) END
                FROM dbo.PedidoDetalle d
                CROSS APPLY (SELECT Cantidad = CASE WHEN @Destino = 'DEVUELTO' THEN d.Cantidad - d.CantidadDevuelta ELSE 1 END) x
                WHERE d.IDPedido = @IDPedido
                  AND (@Destino = 'DEVUELTO'
                       OR d.IDPedidoDetalle = (SELECT MIN(IDPedidoDetalle) FROM dbo.PedidoDetalle WHERE IDPedido = @IDPedido));

                SET @Completa = CASE WHEN EXISTS (SELECT 1 FROM dbo.PedidoDetalle d
                                                  LEFT JOIN @Dev x ON x.IDPedidoDetalle = d.IDPedidoDetalle
                                                  WHERE d.IDPedido = @IDPedido AND d.CantidadDevuelta + ISNULL(x.Cantidad, 0) < d.Cantidad)
                                     THEN 0 ELSE 1 END;
                SELECT @MontoLineas = SUM(Monto) FROM @Dev;
                SET @Reembolso = @MontoLineas + CASE WHEN @Completa = 1 THEN @CostoEnvio ELSE 0 END;

                INSERT INTO dbo.Devolucion (IDPedido, IDUsuario, Motivo, MontoReembolso, IncluyeEnvio, Fecha)
                VALUES (@IDPedido, @IDOperador, @Motivo, @Reembolso, @Completa, @Fecha);
                SET @IDDevolucion = SCOPE_IDENTITY();

                INSERT INTO dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, MontoReembolso)
                SELECT @IDDevolucion, IDPedidoDetalle, Cantidad, Monto FROM @Dev;

                UPDATE d SET d.CantidadDevuelta = d.CantidadDevuelta + x.Cantidad, d.MontoDevuelto = d.MontoDevuelto + x.Monto
                FROM dbo.PedidoDetalle d INNER JOIN @Dev x ON x.IDPedidoDetalle = d.IDPedidoDetalle;

                DELETE FROM @Mov;
                UPDATE v SET v.Existencia = v.Existencia + x.Cantidad
                OUTPUT inserted.IDVariante, x.Cantidad, deleted.Existencia, inserted.Existencia INTO @Mov
                FROM dbo.Variante v INNER JOIN @Dev x ON x.IDVariante = v.IDVariante;

                INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo,
                                        IDPedido, IDDevolucion, IDUsuario, Fecha)
                SELECT IDVariante, @TipoDev, Cantidad, Anterior, Nueva, CONCAT(N'Devolución del pedido ', @Numero, N': ', @Motivo),
                       @IDPedido, @IDDevolucion, @IDOperador, @Fecha
                FROM @Mov;

                INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario, Fecha)
                VALUES (@IDPedido, @EstEnt, CASE WHEN @Completa = 1 THEN @EstDev ELSE @EstDevP END, @IDOperador, @Motivo, @Fecha);

                UPDATE dbo.Pedido
                SET MontoDevuelto = MontoDevuelto + @Reembolso,
                    IDEstadoPedido = CASE WHEN @Completa = 1 THEN @EstDev ELSE @EstDevP END,
                    ComentarioEstado = @Motivo,
                    FechaActualizacion = @Fecha
                WHERE IDPedido = @IDPedido;

                UPDATE dbo.Pago
                SET MontoReembolsado = MontoReembolsado + @Reembolso,
                    Estado = CASE WHEN MontoReembolsado + @Reembolso >= Monto THEN 'REEMBOLSADO' ELSE 'REEMBOLSO_PARCIAL' END,
                    FechaActualizacion = @Fecha
                WHERE IDPedido = @IDPedido;
            END;
        END;

        FETCH NEXT FROM cEventos INTO @Fecha, @Tipo, @N;
    END;

    CLOSE cEventos;
    DEALLOCATE cEventos;

    /* 4. Carritos activos: algunos abandonados (para el reporte) y otros recientes ---- */
    DECLARE @Carritos TABLE (Num INT, IDUsuario INT NULL, Token UNIQUEIDENTIFIER NULL, HorasAtras INT);
    INSERT INTO @Carritos (Num, IDUsuario, Token, HorasAtras)
    SELECT c.Num, c.IDUsuario, NULL,
           CASE WHEN c.Num IN (9, 10) THEN 2 ELSE 30 + c.Num * 17 END
    FROM @Clientes c
    WHERE c.Num BETWEEN 2 AND 10
    UNION ALL
    SELECT 100 + n, NULL, CAST(CONCAT('00000000-0000-4000-8000-00000000000', n) AS UNIQUEIDENTIFIER), 50 * n
    FROM (VALUES (1), (2)) AS g (n);

    DECLARE @NumCarrito INT, @Horas INT, @Token UNIQUEIDENTIFIER;
    DECLARE cCarritos CURSOR LOCAL FAST_FORWARD FOR SELECT Num, IDUsuario, Token, HorasAtras FROM @Carritos ORDER BY Num;
    OPEN cCarritos;
    FETCH NEXT FROM cCarritos INTO @NumCarrito, @IDUsuario, @Token, @Horas;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo.Carrito (IDUsuario, TokenInvitado, Estado, FechaCreacion, FechaUltimaActividad)
        VALUES (@IDUsuario, @Token, 'ACTIVO', DATEADD(HOUR, -@Horas - 1, @Ahora), DATEADD(HOUR, -@Horas, @Ahora));
        SET @IDCarrito = SCOPE_IDENTITY();

        INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad, FechaAgregado)
        SELECT DISTINCT @IDCarrito, v.IDVariante, 1, DATEADD(HOUR, -@Horas - 1, @Ahora)
        FROM (VALUES (0), (1)) AS k (k)
        INNER JOIN @Vars v ON v.Num = (@NumCarrito * 41 + k.k * 53) % @NumVars
        WHERE k.k < 1 + (@NumCarrito % 2);

        FETCH NEXT FROM cCarritos INTO @NumCarrito, @IDUsuario, @Token, @Horas;
    END;
    CLOSE cCarritos;
    DEALLOCATE cCarritos;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    ENABLE TRIGGER dbo.TR_Pedido_Estado ON dbo.Pedido;
    ENABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
    ENABLE TRIGGER dbo.TR_Cupon_Bitacora ON dbo.Cupon;
    THROW;
END CATCH;
GO

ENABLE TRIGGER dbo.TR_Pedido_Estado ON dbo.Pedido;
ENABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
ENABLE TRIGGER dbo.TR_Cupon_Bitacora ON dbo.Cupon;
GO
