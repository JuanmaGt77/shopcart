/* =============================================================================
   ShopCart · 027 · SPs de checkout (inicio del pago y reserva de existencia)
   -----------------------------------------------------------------------------
   Flujo:
   1. SP_Checkout_Iniciar: el cliente elige dirección y envío. Se congelan los
      precios y el descuento del cupón (lo que el cliente ve en el resumen) y se
      reservan las unidades por 15 minutos (parámetro SEGUNDOS_RESERVA_CHECKOUT).
   2. SP_Pedidos_CrearPedido (script 029): el cliente paga y en una sola
      transacción se crea el pedido usando los montos congelados.
   3. Si no paga a tiempo, SP_Inventario_LiberarReservasVencidas devuelve las
      unidades y marca el checkout como EXPIRADO.

   Orden de bloqueos en todo el sistema: Carrito -> Checkout -> Cupon -> Variante.
   Mientras todos los SPs pidan los bloqueos en ese orden no se forman deadlocks.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ListarMetodosEnvio
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDMetodoEnvio, Codigo, Nombre, Descripcion, Costo, DiasEstimadosMin, DiasEstimadosMax
    FROM dbo.MetodoEnvio
    WHERE Activo = 1
    ORDER BY Costo, Nombre;
END;
GO

-- Interno. Cancela el checkout activo de un carrito y devuelve su reserva.
-- Lo usan el carrito (si el cliente lo modifica, el checkout deja de ser válido)
-- y SP_Checkout_Iniciar (si el cliente vuelve a iniciar el pago).
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_CancelarActivoDeCarrito
    @IDCarrito INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCheckout INT, @Expira DATETIME2(3), @Ahora DATETIME2(3) = SYSUTCDATETIME();

    SELECT @IDCheckout = IDCheckout, @Expira = FechaExpiracion
    FROM dbo.Checkout WITH (UPDLOCK, ROWLOCK)
    WHERE IDCarrito = @IDCarrito AND Estado = 'ACTIVO';

    IF @IDCheckout IS NULL RETURN;

    UPDATE v
    SET v.Reservada = v.Reservada - d.Cantidad
    FROM dbo.Variante v
    INNER JOIN dbo.CheckoutDetalle d ON d.IDVariante = v.IDVariante
    WHERE d.IDCheckout = @IDCheckout;

    UPDATE dbo.Checkout
    SET Estado = CASE WHEN @Expira <= @Ahora THEN 'EXPIRADO' ELSE 'CANCELADO' END,
        FechaCierre = @Ahora
    WHERE IDCheckout = @IDCheckout;
END;
GO

-- Interno. Resumen del checkout: encabezado y líneas.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ConsultarPorID
    @IDCheckout INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    SELECT c.IDCheckout, c.IDUsuario, c.Estado, c.FechaCreacion, c.FechaExpiracion,
           SegundosRestantes = CASE WHEN c.Estado = 'ACTIVO' AND c.FechaExpiracion > @Ahora
                                    THEN DATEDIFF(SECOND, @Ahora, c.FechaExpiracion) ELSE 0 END,
           c.Subtotal, c.Descuento, c.CostoEnvio, c.Total, iva.BaseImponible, iva.MontoIVA,
           c.IDCupon, CodigoCupon = cu.Codigo,
           c.IDMetodoEnvio, MetodoEnvio = me.Nombre, me.DiasEstimadosMin, me.DiasEstimadosMax,
           c.IDDireccion, DireccionAlias = dir.Alias, Destinatario = dir.NombreDestinatario, DireccionTexto = dir.Texto,
           IDPedido = p.IDPedido, NumeroPedido = p.NumeroPedido
    FROM dbo.Checkout c
    INNER JOIN dbo.MetodoEnvio me ON me.IDMetodoEnvio = c.IDMetodoEnvio
    LEFT JOIN dbo.Cupon cu        ON cu.IDCupon = c.IDCupon
    LEFT JOIN dbo.Pedido p        ON p.IDCheckout = c.IDCheckout
    OUTER APPLY dbo.FU_Direcciones_TextoEntrega(c.IDDireccion) dir
    CROSS APPLY dbo.FU_Pedidos_DesgloseIVA(c.Total) iva
    WHERE c.IDCheckout = @IDCheckout;

    SELECT d.IDVariante, vd.SKU, vd.NombreProducto, vd.DescripcionVariante, d.Cantidad, d.PrecioUnitario,
           d.Subtotal, d.Descuento, Total = d.Subtotal - d.Descuento, vd.Disponible,
           ImagenUrl = (SELECT TOP (1) i.Url FROM dbo.ProductoImagen i WHERE i.IDProducto = vd.IDProducto ORDER BY i.Orden)
    FROM dbo.CheckoutDetalle d
    INNER JOIN dbo.VW_Catalogo_VarianteDetalle vd ON vd.IDVariante = d.IDVariante
    WHERE d.IDCheckout = @IDCheckout
    ORDER BY d.IDCheckoutDetalle;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Iniciar
    @IDUsuario      INT,
    @IDDireccion    INT,
    @IDMetodoEnvio  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @Segundos INT = ISNULL((SELECT Valor FROM dbo.ParametroSistema WHERE Clave = 'SEGUNDOS_RESERVA_CHECKOUT'), 900);
    DECLARE @IDCarrito INT, @IDCupon INT, @IDCheckout INT, @Duenio INT, @DireccionActiva BIT, @CostoEnvio DECIMAL(12,2);
    DECLARE @Subtotal DECIMAL(12,2), @Descuento DECIMAL(12,2) = 0, @SubtotalElegible DECIMAL(12,2) = 0, @IDCategoriaCupon INT;
    DECLARE @Resultado VARCHAR(30), @MensajeCupon NVARCHAR(300), @Lista NVARCHAR(1500), @Mensaje NVARCHAR(2000), @NumeroError INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Carrito activo del cliente, bloqueado mientras armo el checkout
        SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon
        FROM dbo.Carrito WITH (UPDLOCK, ROWLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';

        IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito)
            THROW 54001, N'Tu carrito está vacío.', 1;

        -- 2. La dirección tiene que ser del cliente
        SELECT @Duenio = IDUsuario, @DireccionActiva = Activo FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;
        IF @Duenio IS NULL
            THROW 56001, N'La dirección no existe.', 1;
        IF @Duenio <> @IDUsuario
            THROW 50003, N'No tienes permiso para usar esta dirección.', 1;
        IF @DireccionActiva = 0
            THROW 56002, N'Esa dirección fue eliminada; elige otra.', 1;

        -- 3. Método de envío
        SELECT @CostoEnvio = Costo FROM dbo.MetodoEnvio WHERE IDMetodoEnvio = @IDMetodoEnvio AND Activo = 1;
        IF @CostoEnvio IS NULL
            THROW 57004, N'El método de envío no existe o no está disponible.', 1;

        -- 4. Si ya había un checkout activo de este carrito se cancela y se libera su reserva
        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        -- 5. Todo lo del carrito tiene que seguir a la venta
        SELECT @Lista = STRING_AGG(CAST(CONCAT(l.NombreProducto, N' (', l.SKU, N')') AS NVARCHAR(200)), N', ')
        FROM dbo.FU_Carrito_Lineas(@IDCarrito) l
        WHERE l.Vendible = 0;
        IF @Lista IS NOT NULL
        BEGIN
            SET @Mensaje = CONCAT(N'Algunos productos de tu carrito ya no están a la venta: ', @Lista, N'. Quítalos para continuar.');
            THROW 52025, @Mensaje, 1;
        END;

        SELECT @Subtotal = SUM(l.Subtotal) FROM dbo.FU_Carrito_Lineas(@IDCarrito) l;

        -- 6. Cupón: se evalúa con las mismas reglas que en el carrito
        IF @IDCupon IS NOT NULL
        BEGIN
            SELECT @Resultado = e.Resultado, @MensajeCupon = e.Mensaje, @Descuento = e.Descuento,
                   @SubtotalElegible = e.SubtotalElegible
            FROM dbo.FU_Cupones_EvaluarCarrito(@IDCupon, @IDCarrito, @IDUsuario, @Ahora) e;

            IF @Resultado <> 'OK'
            BEGIN
                SET @NumeroError = (SELECT NumeroError FROM dbo.FU_Cupones_NumeroError(@Resultado));
                SET @Mensaje = CONCAT(@MensajeCupon, N' Quita el cupón para continuar.');
                THROW @NumeroError, @Mensaje, 1;
            END;

            SELECT @IDCategoriaCupon = IDCategoria FROM dbo.Cupon WHERE IDCupon = @IDCupon;
        END;

        -- 7. Encabezado con los montos congelados
        INSERT INTO dbo.Checkout (IDCarrito, IDUsuario, IDDireccion, IDMetodoEnvio, IDCupon, Subtotal, Descuento,
                                  CostoEnvio, Total, FechaCreacion, FechaExpiracion)
        VALUES (@IDCarrito, @IDUsuario, @IDDireccion, @IDMetodoEnvio, @IDCupon, @Subtotal, @Descuento,
                @CostoEnvio, @Subtotal - @Descuento + @CostoEnvio, @Ahora, DATEADD(SECOND, @Segundos, @Ahora));
        SET @IDCheckout = SCOPE_IDENTITY();

        -- 8. Detalle con el precio congelado. El descuento se reparte entre las líneas
        --    a las que aplica (para poder calcular reembolsos de devoluciones parciales).
        --    Cada parte se trunca y los centavos que sobran van a la línea más grande,
        --    así la suma de las partes es exactamente el descuento total.
        WITH Lineas AS (
            SELECT l.IDVariante, l.Cantidad, l.PrecioUnitario, l.Subtotal,
                   Elegible = CASE WHEN @IDCupon IS NOT NULL
                                    AND (@IDCategoriaCupon IS NULL OR l.IDCategoria = @IDCategoriaCupon) THEN 1 ELSE 0 END
            FROM dbo.FU_Carrito_Lineas(@IDCarrito) l
        ),
        Prorrateo AS (
            SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal,
                   Base  = CASE WHEN Elegible = 1 AND @SubtotalElegible > 0
                                THEN CAST(ROUND(@Descuento * Subtotal / @SubtotalElegible, 2, 1) AS DECIMAL(12,2))
                                ELSE CAST(0 AS DECIMAL(12,2)) END,
                   Orden = ROW_NUMBER() OVER (ORDER BY Elegible DESC, Subtotal DESC, IDVariante)
            FROM Lineas
        )
        INSERT INTO dbo.CheckoutDetalle (IDCheckout, IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento)
        SELECT @IDCheckout, IDVariante, Cantidad, PrecioUnitario, Subtotal,
               Base + CASE WHEN Orden = 1 THEN @Descuento - SUM(Base) OVER () ELSE 0 END
        FROM Prorrateo;

        -- 9. Reserva de existencia: si una línea no alcanza, falla todo
        EXEC dbo.SP_Inventario_ReservarExistencia @IDCheckout;

        UPDATE dbo.Carrito SET FechaUltimaActividad = @Ahora WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Checkout_ConsultarPorID @IDCheckout;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Obtener
    @IDUsuario  INT,
    @IDCheckout INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Duenio INT = (SELECT IDUsuario FROM dbo.Checkout WHERE IDCheckout = @IDCheckout);

    IF @Duenio IS NULL
        THROW 57001, N'El checkout no existe.', 1;
    IF @Duenio <> @IDUsuario
        THROW 50003, N'No tienes permiso para ver este checkout.', 1;

    EXEC dbo.SP_Checkout_ConsultarPorID @IDCheckout;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Cancelar
    @IDUsuario  INT,
    @IDCheckout INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Duenio INT, @Estado VARCHAR(12), @IDCarrito INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @IDCarrito = IDCarrito FROM dbo.Checkout WHERE IDCheckout = @IDCheckout;
        IF @IDCarrito IS NOT NULL
            SELECT @IDCarrito = IDCarrito FROM dbo.Carrito WITH (UPDLOCK, ROWLOCK) WHERE IDCarrito = @IDCarrito;

        SELECT @Duenio = IDUsuario, @Estado = Estado
        FROM dbo.Checkout WITH (UPDLOCK, ROWLOCK)
        WHERE IDCheckout = @IDCheckout;

        IF @Duenio IS NULL
            THROW 57001, N'El checkout no existe.', 1;
        IF @Duenio <> @IDUsuario
            THROW 50003, N'No tienes permiso para cancelar este checkout.', 1;
        IF @Estado <> 'ACTIVO'
            THROW 57003, N'Este checkout ya no está activo.', 1;

        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Checkout_ConsultarPorID @IDCheckout;
END;
GO
