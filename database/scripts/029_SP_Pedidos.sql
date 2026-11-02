/* =============================================================================
   ShopCart · 029 · SPs de pedidos
   -----------------------------------------------------------------------------
   SP_Pedidos_CrearPedido es el corazón del checkout. En UNA transacción:
     pedido + detalle + salida de inventario (kardex) + uso del cupón + pago
     + cierre del checkout y del carrito. Si algo falla, no se guarda nada.

   Cómo evita pedidos y cobros duplicados (doble clic o reintento por red):
     a) Si llega la misma Idempotency-Key, devuelve el pedido que ya existe.
     b) Si llega otra clave para un checkout ya pagado, también devuelve el
        pedido existente (el checkout solo se puede completar una vez).
     c) Si dos solicitudes llegan exactamente al mismo tiempo, la segunda
        espera el UPDLOCK del checkout; cuando entra, el checkout ya está
        COMPLETADO. Y si aun así algo se colara, los UNIQUE de Pedido
        (IDCheckout y clave de idempotencia) y de Pago (IDPedido) lo frenan.

   Ciclo de vida (tabla EstadoPedidoTransicion, validado también por trigger):
     PAGADO -> EN_PREPARACION -> DESPACHADO -> ENTREGADO
     PAGADO | EN_PREPARACION -> CANCELADO
     ENTREGADO -> DEVUELTO_PARCIAL | DEVUELTO,  DEVUELTO_PARCIAL -> DEVUELTO
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarEstados
AS
BEGIN
    SET NOCOUNT ON;
    SELECT e.IDEstadoPedido, e.Codigo, e.Nombre, e.Descripcion, e.EsInicial, e.EsFinal, e.CuentaComoVenta, e.Orden,
           Siguientes = (SELECT ed.Codigo AS codigo, ed.Nombre AS nombre
                         FROM dbo.EstadoPedidoTransicion t
                         INNER JOIN dbo.EstadoPedido ed ON ed.IDEstadoPedido = t.IDEstadoDestino
                         WHERE t.IDEstadoOrigen = e.IDEstadoPedido
                         ORDER BY ed.Orden
                         FOR JSON PATH)
    FROM dbo.EstadoPedido e
    ORDER BY e.Orden;
END;
GO

-- Interno. Pedido completo en 5 resultados: encabezado, líneas, historial, pago y devoluciones.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ConsultarPorID
    @IDPedido INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.IDPedido, r.NumeroPedido, r.IDUsuario, r.Cliente, r.CorreoCliente, r.EstadoCodigo, r.Estado,
           r.Subtotal, r.Descuento, r.CostoEnvio, r.Total, p.BaseImponible, p.MontoIVA, r.MontoDevuelto,
           r.CodigoCupon, r.MetodoEnvioNombre, p.EntregaDestinatario, p.EntregaTelefono, p.EntregaDireccion,
           r.CantidadArticulos, p.IDCheckout, r.FechaCreacion, r.FechaActualizacion
    FROM dbo.VW_Pedidos_Resumen r
    INNER JOIN dbo.Pedido p ON p.IDPedido = r.IDPedido
    WHERE r.IDPedido = @IDPedido;

    SELECT d.IDPedidoDetalle, d.IDVariante, d.SKU, d.NombreProducto, d.DescripcionVariante, d.Cantidad,
           d.PrecioUnitario, d.Subtotal, d.Descuento, d.Total, d.CantidadDevuelta, d.MontoDevuelto,
           CantidadDevolvible = d.Cantidad - d.CantidadDevuelta,
           ImagenUrl = (SELECT TOP (1) i.Url FROM dbo.ProductoImagen i
                        INNER JOIN dbo.Variante v ON v.IDProducto = i.IDProducto
                        WHERE v.IDVariante = d.IDVariante ORDER BY i.Orden)
    FROM dbo.PedidoDetalle d
    WHERE d.IDPedido = @IDPedido
    ORDER BY d.IDPedidoDetalle;

    SELECT IDPedidoHistorialEstado, EstadoAnteriorCodigo, EstadoAnterior, EstadoNuevoCodigo, EstadoNuevo,
           IDUsuario, Usuario, RolUsuario, Comentario, Fecha
    FROM dbo.VW_Pedidos_Historial
    WHERE IDPedido = @IDPedido
    ORDER BY Fecha, IDPedidoHistorialEstado;

    SELECT IDPago, Metodo, MarcaTarjeta, UltimosDigitos, CodigoAutorizacion, Monto, MontoReembolsado, Estado, FechaPago
    FROM dbo.Pago
    WHERE IDPedido = @IDPedido;

    SELECT dv.IDDevolucion, dv.Motivo, dv.MontoReembolso, dv.IncluyeEnvio, dv.Fecha,
           RegistradaPor = CONCAT(u.Nombres, N' ', u.Apellidos),
           Lineas = (SELECT dd.IDPedidoDetalle AS idPedidoDetalle, pd.SKU AS sku, dd.Cantidad AS cantidad,
                            dd.MontoReembolso AS montoReembolso
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

-- Detalle de un pedido. Un cliente solo puede ver los suyos; el personal ve todos.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Obtener
    @IDPedido               INT,
    @IDUsuarioSolicitante   INT,
    @EsPersonal             BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Duenio INT = (SELECT IDUsuario FROM dbo.Pedido WHERE IDPedido = @IDPedido);

    IF @Duenio IS NULL
        THROW 58001, N'El pedido no existe.', 1;
    IF @EsPersonal = 0 AND @Duenio <> @IDUsuarioSolicitante
        THROW 50003, N'No tienes permiso para ver este pedido.', 1;

    EXEC dbo.SP_Pedidos_ConsultarPorID @IDPedido;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerPorIdempotencia
    @IDUsuario          INT,
    @ClaveIdempotencia  VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDPedido, IDCheckout
    FROM dbo.Pedido
    WHERE IDUsuario = @IDUsuario AND ClaveIdempotencia = @ClaveIdempotencia;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDUsuario          INT,
    @IDCheckout         INT,
    @ClaveIdempotencia  VARCHAR(100),
    @CodigoAutorizacion VARCHAR(50),
    @MarcaTarjeta       VARCHAR(20) = NULL,
    @UltimosDigitos     CHAR(4)     = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDPedido INT, @IDCheckoutPrevio INT, @EsDuplicado BIT = 0;
    DECLARE @IDCarrito INT, @Duenio INT, @Estado VARCHAR(12), @Expira DATETIME2(3), @IDCupon INT,
            @CodigoCupon VARCHAR(30), @IDDireccion INT, @IDMetodoEnvio INT, @Subtotal DECIMAL(12,2),
            @Descuento DECIMAL(12,2), @CostoEnvio DECIMAL(12,2), @Total DECIMAL(12,2), @NumeroPedido VARCHAR(20);
    DECLARE @IDEstadoInicial INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE EsInicial = 1);
    DECLARE @IDTipoVenta INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'SALIDA_VENTA');
    DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

    IF @ClaveIdempotencia IS NULL OR LEN(@ClaveIdempotencia) < 8
        THROW 50001, N'Falta la clave de idempotencia del pago (encabezado Idempotency-Key).', 1;

    -- 1. Repetición exacta de un pago ya procesado: devuelvo el mismo pedido sin tocar nada
    SELECT @IDPedido = IDPedido, @IDCheckoutPrevio = IDCheckout
    FROM dbo.Pedido
    WHERE IDUsuario = @IDUsuario AND ClaveIdempotencia = @ClaveIdempotencia;

    IF @IDPedido IS NOT NULL
    BEGIN
        IF @IDCheckoutPrevio <> @IDCheckout
            THROW 57005, N'Esa clave de idempotencia ya se usó para otro pago.', 1;
        SET @EsDuplicado = 1;
    END
    ELSE
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;

            -- 2. Bloqueos en el orden de todo el sistema: carrito -> checkout -> cupón -> variantes
            SELECT @IDCarrito = IDCarrito FROM dbo.Checkout WHERE IDCheckout = @IDCheckout;
            IF @IDCarrito IS NULL
                THROW 57001, N'El checkout no existe.', 1;

            SELECT @IDCarrito = IDCarrito FROM dbo.Carrito WITH (UPDLOCK, ROWLOCK) WHERE IDCarrito = @IDCarrito;

            SELECT @Duenio = IDUsuario, @Estado = Estado, @Expira = FechaExpiracion, @IDCupon = IDCupon,
                   @IDDireccion = IDDireccion, @IDMetodoEnvio = IDMetodoEnvio, @Subtotal = Subtotal,
                   @Descuento = Descuento, @CostoEnvio = CostoEnvio, @Total = Total
            FROM dbo.Checkout WITH (UPDLOCK, ROWLOCK)
            WHERE IDCheckout = @IDCheckout;

            IF @Duenio <> @IDUsuario
                THROW 50003, N'No tienes permiso para pagar este checkout.', 1;

            IF @Estado = 'COMPLETADO'
            BEGIN
                -- Doble clic que llegó con otra clave: ya se pagó, devuelvo ese pedido
                SELECT @IDPedido = IDPedido FROM dbo.Pedido WHERE IDCheckout = @IDCheckout;
                SET @EsDuplicado = 1;
            END
            ELSE IF @Estado <> 'ACTIVO'
                THROW 57003, N'Este checkout ya no está activo. Vuelve a iniciar el pago.', 1;
            ELSE IF @Expira <= @Ahora
            BEGIN
                -- La reserva venció: libero las unidades, confirmo eso y luego aviso
                UPDATE v
                SET v.Reservada = v.Reservada - d.Cantidad
                FROM dbo.Variante v
                INNER JOIN dbo.CheckoutDetalle d ON d.IDVariante = v.IDVariante
                WHERE d.IDCheckout = @IDCheckout;

                UPDATE dbo.Checkout SET Estado = 'EXPIRADO', FechaCierre = @Ahora WHERE IDCheckout = @IDCheckout;
                COMMIT TRANSACTION;

                THROW 57002, N'Tu reserva expiró y las unidades se liberaron. Vuelve a iniciar el pago.', 1;
            END
            ELSE
            BEGIN
                -- 3. Cupón: el límite total se respeta con un UPDATE condicional (atómico)
                IF @IDCupon IS NOT NULL
                BEGIN
                    UPDATE dbo.Cupon
                    SET UsosActuales = UsosActuales + 1
                    WHERE IDCupon = @IDCupon
                      AND (LimiteUsosTotal IS NULL OR UsosActuales < LimiteUsosTotal);

                    IF @@ROWCOUNT = 0
                        THROW 55005, N'El cupón se agotó mientras completabas tu compra. Quita el cupón y vuelve a iniciar el pago.', 1;

                    -- El UPDATE de arriba ya bloqueó la fila del cupón: este conteo queda serializado
                    IF EXISTS (SELECT 1 FROM dbo.Cupon c
                               WHERE c.IDCupon = @IDCupon
                                 AND c.LimiteUsosPorCliente IS NOT NULL
                                 AND c.LimiteUsosPorCliente <= (SELECT COUNT(*) FROM dbo.CuponUso u
                                                                WHERE u.IDCupon = @IDCupon
                                                                  AND u.IDUsuario = @IDUsuario
                                                                  AND u.Estado = 'APLICADO'))
                        THROW 55006, N'Ya usaste este cupón la cantidad máxima de veces permitida.', 1;

                    SELECT @CodigoCupon = Codigo FROM dbo.Cupon WHERE IDCupon = @IDCupon;
                END;

                -- 4. Pedido con la copia de la entrega y los montos congelados en el checkout
                INSERT INTO dbo.Pedido (IDUsuario, IDCheckout, IDEstadoPedido, IDMetodoEnvio, IDDireccion, IDCupon,
                                        EntregaDestinatario, EntregaTelefono, EntregaDireccion, MetodoEnvioNombre, CodigoCupon,
                                        Subtotal, Descuento, CostoEnvio, Total, BaseImponible, MontoIVA,
                                        ComentarioEstado, ClaveIdempotencia, FechaCreacion)
                SELECT @IDUsuario, @IDCheckout, @IDEstadoInicial, @IDMetodoEnvio, @IDDireccion, @IDCupon,
                       dir.NombreDestinatario, dir.Telefono, dir.Texto, me.Nombre, @CodigoCupon,
                       @Subtotal, @Descuento, @CostoEnvio, @Total, iva.BaseImponible, iva.MontoIVA,
                       N'Pago aprobado', @ClaveIdempotencia, @Ahora
                FROM dbo.FU_Direcciones_TextoEntrega(@IDDireccion) dir
                INNER JOIN dbo.MetodoEnvio me ON me.IDMetodoEnvio = @IDMetodoEnvio
                CROSS APPLY dbo.FU_Pedidos_DesgloseIVA(@Total) iva;

                SET @IDPedido = SCOPE_IDENTITY();
                SELECT @NumeroPedido = NumeroPedido FROM dbo.Pedido WHERE IDPedido = @IDPedido;

                -- 5. Detalle con la foto del producto y el precio congelado
                INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, IDCategoria, SKU, NombreProducto, DescripcionVariante,
                                               Cantidad, PrecioUnitario, Subtotal, Descuento, Total)
                SELECT @IDPedido, cd.IDVariante, vd.IDCategoria, vd.SKU, vd.NombreProducto, vd.DescripcionVariante,
                       cd.Cantidad, cd.PrecioUnitario, cd.Subtotal, cd.Descuento, cd.Subtotal - cd.Descuento
                FROM dbo.CheckoutDetalle cd
                INNER JOIN dbo.VW_Catalogo_VarianteDetalle vd ON vd.IDVariante = cd.IDVariante
                WHERE cd.IDCheckout = @IDCheckout;

                -- 6. Salida de inventario: consume la reserva y baja la existencia física
                UPDATE v
                SET v.Existencia = v.Existencia - cd.Cantidad,
                    v.Reservada = v.Reservada - cd.Cantidad,
                    v.FechaActualizacion = @Ahora
                OUTPUT inserted.IDVariante, cd.Cantidad, deleted.Existencia, inserted.Existencia
                    INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
                FROM dbo.Variante v
                INNER JOIN dbo.CheckoutDetalle cd ON cd.IDVariante = v.IDVariante
                WHERE cd.IDCheckout = @IDCheckout;

                INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva,
                                        Motivo, IDPedido, IDUsuario, Fecha)
                SELECT IDVariante, @IDTipoVenta, -Cantidad, Anterior, Nueva,
                       CONCAT(N'Venta del pedido ', @NumeroPedido), @IDPedido, @IDUsuario, @Ahora
                FROM @Movimientos;

                -- 7. Uso del cupón
                IF @IDCupon IS NOT NULL
                    INSERT INTO dbo.CuponUso (IDCupon, IDUsuario, IDPedido, MontoDescuento, FechaUso)
                    VALUES (@IDCupon, @IDUsuario, @IDPedido, @Descuento, @Ahora);

                -- 8. El cobro: uno solo por pedido (UQ_Pago_Pedido)
                INSERT INTO dbo.Pago (IDPedido, MarcaTarjeta, UltimosDigitos, CodigoAutorizacion, Monto, FechaPago)
                VALUES (@IDPedido, @MarcaTarjeta, @UltimosDigitos, @CodigoAutorizacion, @Total, @Ahora);

                -- 9. Cierro el checkout y el carrito
                UPDATE dbo.Checkout SET Estado = 'COMPLETADO', FechaCierre = @Ahora WHERE IDCheckout = @IDCheckout;
                UPDATE dbo.Carrito
                SET Estado = 'CONVERTIDO', FechaCierre = @Ahora, FechaUltimaActividad = @Ahora
                WHERE IDCarrito = @IDCarrito;
            END;

            IF @@TRANCOUNT > 0 COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

            IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Pedido_%'
            BEGIN
                -- Dos solicitudes idénticas al mismo tiempo: el UNIQUE dejó pasar solo una
                SELECT @IDPedido = IDPedido FROM dbo.Pedido WHERE IDCheckout = @IDCheckout AND IDUsuario = @IDUsuario;
                IF @IDPedido IS NULL
                    THROW;
                SET @EsDuplicado = 1;
            END
            ELSE
                THROW;
        END CATCH;
    END;

    SELECT IDPedido = @IDPedido, EsDuplicado = @EsDuplicado;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarMisPedidos
    @IDUsuario      INT,
    @CodigoEstado   VARCHAR(20) = NULL,
    @Pagina         INT         = 1,
    @TamanoPagina   INT         = 10
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    SELECT IDPedido, NumeroPedido, EstadoCodigo, Estado, Subtotal, Descuento, CostoEnvio, Total, MontoDevuelto,
           CodigoCupon, MetodoEnvioNombre, CantidadArticulos, FechaCreacion, FechaActualizacion,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.VW_Pedidos_Resumen
    WHERE IDUsuario = @IDUsuario
      AND (@CodigoEstado IS NULL OR EstadoCodigo = @CodigoEstado)
    ORDER BY FechaCreacion DESC, IDPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

-- Listado del personal con filtros por estado, cliente y rango de fechas (hora de Guatemala)
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @CodigoEstado       VARCHAR(20)   = NULL,
    @Cliente            NVARCHAR(100) = NULL,   -- nombre, correo o número de pedido
    @IDUsuarioCliente   INT           = NULL,
    @Desde              DATE          = NULL,
    @Hasta              DATE          = NULL,
    @OrdenarPor         VARCHAR(10)   = 'FECHA', -- FECHA | TOTAL | NUMERO
    @Direccion          VARCHAR(4)    = 'DESC',
    @Pagina             INT           = 1,
    @TamanoPagina       INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;
    IF @OrdenarPor NOT IN ('FECHA', 'TOTAL', 'NUMERO') OR @Direccion NOT IN ('ASC', 'DESC')
        THROW 50001, N'Ordenamiento inválido.', 1;
    IF @Desde IS NOT NULL AND @Hasta IS NOT NULL AND @Desde > @Hasta
        THROW 50001, N'La fecha inicial no puede ser mayor que la final.', 1;

    DECLARE @Patron NVARCHAR(320) = (SELECT Patron FROM dbo.FU_Sistema_PatronBusqueda(@Cliente));

    SELECT IDPedido, NumeroPedido, IDUsuario, Cliente, CorreoCliente, EstadoCodigo, Estado, Subtotal, Descuento,
           CostoEnvio, Total, MontoDevuelto, CodigoCupon, MetodoEnvioNombre, CantidadArticulos, FechaCreacion,
           FechaActualizacion,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.VW_Pedidos_Resumen
    WHERE (@CodigoEstado IS NULL OR EstadoCodigo = @CodigoEstado)
      AND (@IDUsuarioCliente IS NULL OR IDUsuario = @IDUsuarioCliente)
      AND (@Patron IS NULL OR Cliente LIKE @Patron OR CorreoCliente LIKE @Patron OR NumeroPedido LIKE @Patron)
      AND (@Desde IS NULL OR FechaLocal >= @Desde)
      AND (@Hasta IS NULL OR FechaLocal <= @Hasta)
    ORDER BY
        CASE WHEN @OrdenarPor = 'FECHA'  AND @Direccion = 'ASC'  THEN FechaCreacion END ASC,
        CASE WHEN @OrdenarPor = 'FECHA'  AND @Direccion = 'DESC' THEN FechaCreacion END DESC,
        CASE WHEN @OrdenarPor = 'TOTAL'  AND @Direccion = 'ASC'  THEN Total END ASC,
        CASE WHEN @OrdenarPor = 'TOTAL'  AND @Direccion = 'DESC' THEN Total END DESC,
        CASE WHEN @OrdenarPor = 'NUMERO' AND @Direccion = 'ASC'  THEN IDPedido END ASC,
        CASE WHEN @OrdenarPor = 'NUMERO' AND @Direccion = 'DESC' THEN IDPedido END DESC,
        IDPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

-- Avance normal del pedido (preparación, despacho, entrega). La cancelación y las
-- devoluciones tienen sus propios SPs porque además mueven inventario y dinero.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDUsuarioAccion    INT,
    @IDPedido           INT,
    @CodigoEstadoNuevo  VARCHAR(20),
    @Comentario         NVARCHAR(250) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDEstadoActual INT, @IDEstadoNuevo INT, @NombreActual NVARCHAR(50), @NombreNuevo NVARCHAR(50),
            @Mensaje NVARCHAR(400);

    SELECT @IDEstadoNuevo = IDEstadoPedido, @NombreNuevo = Nombre FROM dbo.EstadoPedido WHERE Codigo = @CodigoEstadoNuevo;
    IF @IDEstadoNuevo IS NULL
        THROW 58004, N'El estado indicado no existe.', 1;
    IF @CodigoEstadoNuevo IN ('CANCELADO', 'DEVUELTO_PARCIAL', 'DEVUELTO')
        THROW 58004, N'Para cancelar o registrar devoluciones usa su operación específica.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @IDEstadoActual = p.IDEstadoPedido, @NombreActual = e.Nombre
        FROM dbo.Pedido p WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @IDEstadoActual IS NULL
            THROW 58001, N'El pedido no existe.', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedidoTransicion
                       WHERE IDEstadoOrigen = @IDEstadoActual AND IDEstadoDestino = @IDEstadoNuevo)
        BEGIN
            SET @Mensaje = CONCAT(N'No se puede pasar un pedido de "', @NombreActual, N'" a "', @NombreNuevo, N'".');
            THROW 58002, @Mensaje, 1;
        END;

        UPDATE dbo.Pedido
        SET IDEstadoPedido = @IDEstadoNuevo,
            ComentarioEstado = NULLIF(LTRIM(RTRIM(@Comentario)), N''),
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDPedido = @IDPedido;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Pedidos_ConsultarPorID @IDPedido;
END;
GO

-- Cancela un pedido que todavía no se despachó: devuelve la existencia por kardex,
-- libera el uso del cupón y reembolsa el pago completo.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Cancelar
    @IDUsuarioAccion    INT,
    @IDPedido           INT,
    @Motivo             NVARCHAR(250),
    @SoloPropio         BIT = 0    -- 1 cuando lo pide un cliente: solo puede cancelar los suyos
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @Duenio INT, @IDEstadoActual INT, @NombreActual NVARCHAR(50), @IDCupon INT, @NumeroPedido VARCHAR(20),
            @Mensaje NVARCHAR(400), @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDCancelado INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'CANCELADO');
    DECLARE @IDTipoCancelacion INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'CANCELACION');
    DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) < 3
        THROW 50001, N'Indica el motivo de la cancelación.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Duenio = p.IDUsuario, @IDEstadoActual = p.IDEstadoPedido, @NombreActual = e.Nombre,
               @IDCupon = p.IDCupon, @NumeroPedido = p.NumeroPedido
        FROM dbo.Pedido p WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @Duenio IS NULL
            THROW 58001, N'El pedido no existe.', 1;
        IF @SoloPropio = 1 AND @Duenio <> @IDUsuarioAccion
            THROW 50003, N'No tienes permiso para cancelar este pedido.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedidoTransicion
                       WHERE IDEstadoOrigen = @IDEstadoActual AND IDEstadoDestino = @IDCancelado)
        BEGIN
            SET @Mensaje = CONCAT(N'El pedido está "', @NombreActual,
                                  N'" y ya no se puede cancelar. Solo se cancelan pedidos que no se han despachado.');
            THROW 58003, @Mensaje, 1;
        END;

        UPDATE dbo.Pedido
        SET IDEstadoPedido = @IDCancelado,
            ComentarioEstado = LTRIM(RTRIM(@Motivo)),
            FechaActualizacion = @Ahora
        WHERE IDPedido = @IDPedido;

        -- Cupón primero (mismo orden de bloqueos que la creación del pedido)
        IF @IDCupon IS NOT NULL
        BEGIN
            UPDATE dbo.CuponUso
            SET Estado = 'REVERTIDO', FechaReversion = @Ahora
            WHERE IDPedido = @IDPedido AND Estado = 'APLICADO';

            IF @@ROWCOUNT > 0
                UPDATE dbo.Cupon SET UsosActuales = UsosActuales - 1 WHERE IDCupon = @IDCupon AND UsosActuales > 0;
        END;

        -- Las unidades vuelven al inventario con un movimiento de kardex
        UPDATE v
        SET v.Existencia = v.Existencia + d.Cantidad,
            v.FechaActualizacion = @Ahora
        OUTPUT inserted.IDVariante, d.Cantidad, deleted.Existencia, inserted.Existencia
            INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
        FROM dbo.Variante v
        INNER JOIN dbo.PedidoDetalle d ON d.IDVariante = v.IDVariante
        WHERE d.IDPedido = @IDPedido;

        INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva,
                                Motivo, IDPedido, IDUsuario, Fecha)
        SELECT IDVariante, @IDTipoCancelacion, Cantidad, Anterior, Nueva,
               LEFT(CONCAT(N'Cancelación del pedido ', @NumeroPedido, N': ', LTRIM(RTRIM(@Motivo))), 250),
               @IDPedido, @IDUsuarioAccion, @Ahora
        FROM @Movimientos;

        -- Reembolso total
        UPDATE dbo.Pago
        SET MontoReembolsado = Monto, Estado = 'REEMBOLSADO', FechaActualizacion = @Ahora
        WHERE IDPedido = @IDPedido;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Pedidos_ConsultarPorID @IDPedido;
END;
GO
