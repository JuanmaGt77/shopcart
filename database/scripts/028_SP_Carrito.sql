/* =============================================================================
   ShopCart · 028 · SPs del carrito
   -----------------------------------------------------------------------------
   - El carrito se identifica por el usuario del token o, si es invitado, por su
     TokenInvitado. El cliente nunca manda un IDCarrito, así que no hay forma de
     apuntar al carrito de otra persona.
   - No se puede tener en el carrito más de lo disponible (existencia física
     menos lo reservado por checkouts en curso).
   - Si el carrito cambia mientras hay un checkout activo, ese checkout se
     cancela y su reserva se libera: el resumen congelado ya no coincidiría.
   - Los montos los calcula FU_Carrito_Resumen con DECIMAL, sin redondeos raros.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Interno. Encuentra (y si se pide, crea) el carrito activo del usuario o del invitado.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ResolverCarrito
    @IDUsuario      INT,
    @TokenInvitado  UNIQUEIDENTIFIER,
    @Crear          BIT,
    @IDCarrito      INT OUTPUT,
    @TokenGenerado  UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @IDCarrito = NULL;
    SET @TokenGenerado = NULL;

    IF @IDUsuario IS NOT NULL
    BEGIN
        -- HOLDLOCK evita que dos solicitudes simultáneas creen dos carritos para el mismo cliente
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';

        IF @IDCarrito IS NULL AND @Crear = 1
        BEGIN
            INSERT INTO dbo.Carrito (IDUsuario) VALUES (@IDUsuario);
            SET @IDCarrito = SCOPE_IDENTITY();
        END;
    END
    ELSE
    BEGIN
        IF @TokenInvitado IS NOT NULL
            SELECT @IDCarrito = IDCarrito
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = 'ACTIVO';

        IF @IDCarrito IS NULL AND @Crear = 1
        BEGIN
            SET @TokenGenerado = NEWID();
            INSERT INTO dbo.Carrito (TokenInvitado) VALUES (@TokenGenerado);
            SET @IDCarrito = SCOPE_IDENTITY();
        END;
    END;
END;
GO

-- Interno. Devuelve el encabezado con totales y las líneas del carrito.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ConsultarPorID
    @IDCarrito INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    SELECT IDCarrito            = c.IDCarrito,
           EsInvitado           = CAST(CASE WHEN c.IDCarrito IS NOT NULL AND c.IDUsuario IS NULL THEN 1 ELSE 0 END AS BIT),
           TokenInvitado        = CASE WHEN c.IDUsuario IS NULL THEN c.TokenInvitado END,
           CantidadArticulos    = ISNULL(r.CantidadArticulos, 0),
           CantidadLineas       = ISNULL(r.CantidadLineas, 0),
           Subtotal             = ISNULL(r.Subtotal, CAST(0 AS DECIMAL(12,2))),
           Descuento            = ISNULL(r.Descuento, CAST(0 AS DECIMAL(12,2))),
           Total                = ISNULL(r.Total, CAST(0 AS DECIMAL(12,2))),
           CodigoCupon          = r.CodigoCupon,
           EstadoCupon          = r.EstadoCupon,
           MensajeCupon         = r.MensajeCupon,
           TieneProblemas       = ISNULL(r.TieneProblemas, CAST(0 AS BIT)),
           IDCheckoutActivo     = ck.IDCheckout,
           CheckoutExpira       = ck.FechaExpiracion,
           FechaUltimaActividad = c.FechaUltimaActividad
    FROM (SELECT 1 AS x) d
    LEFT JOIN dbo.Carrito c ON c.IDCarrito = @IDCarrito
    OUTER APPLY dbo.FU_Carrito_Resumen(c.IDCarrito, @Ahora) r
    OUTER APPLY (SELECT TOP (1) k.IDCheckout, k.FechaExpiracion
                 FROM dbo.Checkout k
                 WHERE k.IDCarrito = c.IDCarrito AND k.Estado = 'ACTIVO' AND k.FechaExpiracion > @Ahora) ck;

    SELECT l.IDVariante, l.SKU, l.IDProducto, l.NombreProducto, l.DescripcionVariante, l.IDCategoria, l.Categoria,
           l.Cantidad, l.PrecioUnitario, l.Subtotal, l.Disponible, l.Vendible, l.ExcedeDisponible, l.ImagenUrl,
           l.FechaAgregado
    FROM dbo.FU_Carrito_Lineas(@IDCarrito) l
    ORDER BY l.FechaAgregado, l.IDCarritoDetalle;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER;

    -- Solo lectura: no crea carrito si no existe
    IF @IDUsuario IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carrito WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';
    ELSE IF @TokenInvitado IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carrito
        WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = 'ACTIVO';

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarProducto
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT,
    @Cantidad       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER, @Actual INT, @Nueva INT,
            @Disponible INT, @Vendible BIT, @Nombre NVARCHAR(150), @SKU VARCHAR(40), @Mensaje NVARCHAR(400);

    IF @Cantidad IS NULL OR @Cantidad < 1 OR @Cantidad > 999
        THROW 50001, N'La cantidad debe estar entre 1 y 999.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, @TokenInvitado, 1, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        -- Si había un checkout en curso se cancela primero (así su reserva vuelve a contar como disponible)
        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        SELECT @Disponible = Disponible, @Vendible = Vendible, @Nombre = NombreProducto, @SKU = SKU
        FROM dbo.VW_Catalogo_VarianteDetalle
        WHERE IDVariante = @IDVariante;

        IF @SKU IS NULL
            THROW 52021, N'El producto que intentas agregar no existe.', 1;
        IF @Vendible = 0
            THROW 52025, N'Ese producto ya no está a la venta.', 1;

        SELECT @Actual = Cantidad
        FROM dbo.CarritoDetalle WITH (UPDLOCK, ROWLOCK)
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        SET @Nueva = ISNULL(@Actual, 0) + @Cantidad;

        IF @Nueva > @Disponible
        BEGIN
            SET @Mensaje = CASE
                WHEN @Disponible <= 0 THEN CONCAT(N'No quedan unidades disponibles de ', @Nombre, N' (', @SKU, N').')
                ELSE CONCAT(N'Solo hay ', @Disponible, N' unidades disponibles de ', @Nombre, N' (', @SKU, N')',
                            CASE WHEN @Actual > 0 THEN CONCAT(N' y ya tienes ', @Actual, N' en tu carrito') ELSE N'' END, N'.')
            END;
            THROW 54002, @Mensaje, 1;
        END;
        IF @Nueva > 999
            THROW 50001, N'No puedes tener más de 999 unidades de un mismo producto.', 1;

        IF @Actual IS NULL
            INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad) VALUES (@IDCarrito, @IDVariante, @Nueva);
        ELSE
            UPDATE dbo.CarritoDetalle
            SET Cantidad = @Nueva, FechaActualizacion = SYSUTCDATETIME()
            WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ActualizarCantidad
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT,
    @Cantidad       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER, @Disponible INT, @Nombre NVARCHAR(150),
            @SKU VARCHAR(40), @Mensaje NVARCHAR(400);

    IF @Cantidad IS NULL OR @Cantidad < 1 OR @Cantidad > 999
        THROW 50001, N'La cantidad debe estar entre 1 y 999. Para quitar el producto usa la opción eliminar.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, @TokenInvitado, 0, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WITH (UPDLOCK)
                                             WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
            THROW 54003, N'Ese producto no está en tu carrito.', 1;

        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        SELECT @Disponible = Disponible, @Nombre = NombreProducto, @SKU = SKU
        FROM dbo.VW_Catalogo_VarianteDetalle WHERE IDVariante = @IDVariante;

        IF @Cantidad > @Disponible
        BEGIN
            SET @Mensaje = CASE WHEN @Disponible <= 0
                                THEN CONCAT(N'No quedan unidades disponibles de ', @Nombre, N' (', @SKU, N').')
                                ELSE CONCAT(N'Solo hay ', @Disponible, N' unidades disponibles de ', @Nombre, N' (', @SKU, N').') END;
            THROW 54002, @Mensaje, 1;
        END;

        UPDATE dbo.CarritoDetalle
        SET Cantidad = @Cantidad, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarProducto
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL,
    @IDVariante     INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, @TokenInvitado, 0, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle
                                             WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
            THROW 54003, N'Ese producto no está en tu carrito.', 1;

        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Vaciar
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, @TokenInvitado, 0, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarrito IS NOT NULL
        BEGIN
            EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;
            DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
            UPDATE dbo.Carrito SET IDCupon = NULL, FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @IDUsuario  INT,
    @Codigo     VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER, @IDCupon INT, @Resultado VARCHAR(30),
            @Mensaje NVARCHAR(300), @NumeroError INT;

    IF @IDUsuario IS NULL
        THROW 54005, N'Inicia sesión para usar cupones de descuento.', 1;

    SET @Codigo = UPPER(LTRIM(RTRIM(@Codigo)));

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, NULL, 0, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito)
            THROW 54001, N'Tu carrito está vacío; agrega productos antes de aplicar un cupón.', 1;

        SELECT @IDCupon = IDCupon FROM dbo.Cupon WHERE Codigo = @Codigo;
        IF @IDCupon IS NULL
        BEGIN
            SET @Mensaje = CONCAT(N'El cupón ', @Codigo, N' no existe.');
            THROW 55001, @Mensaje, 1;
        END;

        SELECT @Resultado = e.Resultado, @Mensaje = e.Mensaje
        FROM dbo.FU_Cupones_EvaluarCarrito(@IDCupon, @IDCarrito, @IDUsuario, SYSUTCDATETIME()) e;

        IF @Resultado <> 'OK'
        BEGIN
            SET @NumeroError = (SELECT NumeroError FROM dbo.FU_Cupones_NumeroError(@Resultado));
            THROW @NumeroError, @Mensaje, 1;
        END;

        EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

        UPDATE dbo.Carrito
        SET IDCupon = @IDCupon, FechaUltimaActividad = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarCupon
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @TokenGenerado UNIQUEIDENTIFIER;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, NULL, 0, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarrito IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Carrito WHERE IDCarrito = @IDCarrito AND IDCupon IS NOT NULL)
        BEGIN
            EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;
            UPDATE dbo.Carrito SET IDCupon = NULL, FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO

-- Al iniciar sesión, lo que el visitante tenía en su carrito de invitado pasa a su carrito.
-- Si al sumar se pasa de lo disponible, se ajusta a lo disponible.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_FusionarInvitado
    @IDUsuario      INT,
    @TokenInvitado  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDCarrito INT, @IDCarritoInvitado INT, @TokenGenerado UNIQUEIDENTIFIER, @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @IDCarritoInvitado = IDCarrito
        FROM dbo.Carrito WITH (UPDLOCK, ROWLOCK)
        WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = 'ACTIVO';

        EXEC dbo.SP_Carrito_ResolverCarrito @IDUsuario, NULL, 1, @IDCarrito OUTPUT, @TokenGenerado OUTPUT;

        IF @IDCarritoInvitado IS NOT NULL
        BEGIN
            EXEC dbo.SP_Checkout_CancelarActivoDeCarrito @IDCarrito;

            -- Productos que ya estaban en el carrito del cliente: se suman sin pasarse de lo disponible
            UPDATE cd
            SET cd.Cantidad = CASE
                    WHEN cd.Cantidad >= v.Disponible THEN cd.Cantidad
                    WHEN cd.Cantidad + g.Cantidad > v.Disponible THEN v.Disponible
                    WHEN cd.Cantidad + g.Cantidad > 999 THEN 999
                    ELSE cd.Cantidad + g.Cantidad END,
                cd.FechaActualizacion = @Ahora
            FROM dbo.CarritoDetalle cd
            INNER JOIN dbo.CarritoDetalle g ON g.IDVariante = cd.IDVariante AND g.IDCarrito = @IDCarritoInvitado
            INNER JOIN dbo.VW_Catalogo_VarianteDetalle v ON v.IDVariante = cd.IDVariante
            WHERE cd.IDCarrito = @IDCarrito AND v.Vendible = 1;

            -- Productos nuevos: se agregan con lo que alcance
            INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
            SELECT @IDCarrito, g.IDVariante, CASE WHEN g.Cantidad > v.Disponible THEN v.Disponible ELSE g.Cantidad END
            FROM dbo.CarritoDetalle g
            INNER JOIN dbo.VW_Catalogo_VarianteDetalle v ON v.IDVariante = g.IDVariante
            WHERE g.IDCarrito = @IDCarritoInvitado
              AND v.Vendible = 1
              AND v.Disponible > 0
              AND NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDCarrito = @IDCarrito AND cd.IDVariante = g.IDVariante);

            UPDATE dbo.Carrito SET Estado = 'FUSIONADO', FechaCierre = @Ahora WHERE IDCarrito = @IDCarritoInvitado;
            UPDATE dbo.Carrito SET FechaUltimaActividad = @Ahora WHERE IDCarrito = @IDCarrito;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_ConsultarPorID @IDCarrito;
END;
GO
