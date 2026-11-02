/* =============================================================================
   ShopCart · 026 · SPs de administración de cupones (solo Administrador)
   -----------------------------------------------------------------------------
   La validación de un cupón contra un carrito está en FU_Cupones_EvaluarCarrito
   (script 011) y el consumo atómico del límite de usos en SP_Pedidos_CrearPedido.
   Aquí solo está el CRUD.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Texto          NVARCHAR(100) = NULL,
    @Estado         VARCHAR(12)   = NULL,    -- VIGENTE | PROGRAMADO | VENCIDO | AGOTADO | INACTIVO
    @Pagina         INT           = 1,
    @TamanoPagina   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    DECLARE @Patron NVARCHAR(320) = (SELECT Patron FROM dbo.FU_Sistema_PatronBusqueda(@Texto));
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    WITH Cupones AS (
        SELECT c.IDCupon, c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.MontoMinimo, c.DescuentoMaximo,
               c.IDCategoria, Categoria = cat.Nombre, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal,
               c.LimiteUsosPorCliente, c.UsosActuales, c.Activo, c.FechaCreacion, c.FechaActualizacion,
               Estado = CASE
                   WHEN c.Activo = 0 THEN 'INACTIVO'
                   WHEN @Ahora < c.FechaInicio THEN 'PROGRAMADO'
                   WHEN @Ahora >= c.FechaFin THEN 'VENCIDO'
                   WHEN c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal THEN 'AGOTADO'
                   ELSE 'VIGENTE' END
        FROM dbo.Cupon c
        LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
        WHERE @Patron IS NULL OR c.Codigo LIKE @Patron OR c.Descripcion LIKE @Patron
    )
    SELECT *, TotalRegistros = COUNT(*) OVER ()
    FROM Cupones
    WHERE @Estado IS NULL OR Estado = @Estado
    ORDER BY FechaCreacion DESC, IDCupon DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Obtener
    @IDCupon INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 55001, N'El cupón no existe.', 1;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    SELECT c.IDCupon, c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.MontoMinimo, c.DescuentoMaximo,
           c.IDCategoria, Categoria = cat.Nombre, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal,
           c.LimiteUsosPorCliente, c.UsosActuales, c.Activo, c.FechaCreacion, c.FechaActualizacion,
           Estado = CASE
               WHEN c.Activo = 0 THEN 'INACTIVO'
               WHEN @Ahora < c.FechaInicio THEN 'PROGRAMADO'
               WHEN @Ahora >= c.FechaFin THEN 'VENCIDO'
               WHEN c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal THEN 'AGOTADO'
               ELSE 'VIGENTE' END
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
    WHERE c.IDCupon = @IDCupon;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Crear
    @IDUsuarioAccion        INT,
    @Codigo                 VARCHAR(30),
    @Descripcion            NVARCHAR(200) = NULL,
    @TipoDescuento          VARCHAR(10),
    @Valor                  DECIMAL(12,2),
    @MontoMinimo            DECIMAL(12,2) = 0,
    @DescuentoMaximo        DECIMAL(12,2) = NULL,
    @IDCategoria            INT           = NULL,
    @FechaInicio            DATETIME2(3),
    @FechaFin               DATETIME2(3),
    @LimiteUsosTotal        INT           = NULL,
    @LimiteUsosPorCliente   INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDCupon INT;
    SET @Codigo = UPPER(LTRIM(RTRIM(@Codigo)));

    IF EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = @Codigo)
        THROW 55009, N'Ya existe un cupón con ese código.', 1;
    IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría del cupón no existe.', 1;
    IF @TipoDescuento NOT IN ('PORCENTAJE', 'MONTO') OR @Valor <= 0 OR (@TipoDescuento = 'PORCENTAJE' AND @Valor > 100)
        THROW 50001, N'El descuento debe ser un porcentaje entre 0 y 100 o un monto fijo mayor a cero.', 1;
    IF @FechaFin <= @FechaInicio
        THROW 50001, N'La fecha de fin debe ser posterior a la fecha de inicio.', 1;

    BEGIN TRY
        INSERT INTO dbo.Cupon (IDCategoria, Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, DescuentoMaximo,
                               FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
        VALUES (@IDCategoria, @Codigo, NULLIF(LTRIM(RTRIM(@Descripcion)), N''), @TipoDescuento, @Valor, ISNULL(@MontoMinimo, 0),
                @DescuentoMaximo, @FechaInicio, @FechaFin, @LimiteUsosTotal, @LimiteUsosPorCliente);
        SET @IDCupon = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 55009, N'Ya existe un cupón con ese código.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Cupones_Obtener @IDCupon;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Actualizar
    @IDUsuarioAccion        INT,
    @IDCupon                INT,
    @Descripcion            NVARCHAR(200) = NULL,
    @TipoDescuento          VARCHAR(10),
    @Valor                  DECIMAL(12,2),
    @MontoMinimo            DECIMAL(12,2) = 0,
    @DescuentoMaximo        DECIMAL(12,2) = NULL,
    @IDCategoria            INT           = NULL,
    @FechaInicio            DATETIME2(3),
    @FechaFin               DATETIME2(3),
    @LimiteUsosTotal        INT           = NULL,
    @LimiteUsosPorCliente   INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @UsosActuales INT, @Mensaje NVARCHAR(300);

    SELECT @UsosActuales = UsosActuales FROM dbo.Cupon WHERE IDCupon = @IDCupon;
    IF @UsosActuales IS NULL
        THROW 55001, N'El cupón no existe.', 1;
    IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría del cupón no existe.', 1;
    IF @TipoDescuento NOT IN ('PORCENTAJE', 'MONTO') OR @Valor <= 0 OR (@TipoDescuento = 'PORCENTAJE' AND @Valor > 100)
        THROW 50001, N'El descuento debe ser un porcentaje entre 0 y 100 o un monto fijo mayor a cero.', 1;
    IF @FechaFin <= @FechaInicio
        THROW 50001, N'La fecha de fin debe ser posterior a la fecha de inicio.', 1;
    IF @LimiteUsosTotal IS NOT NULL AND @LimiteUsosTotal < @UsosActuales
    BEGIN
        SET @Mensaje = CONCAT(N'El cupón ya se usó ', @UsosActuales, N' veces; el límite total no puede ser menor.');
        THROW 55010, @Mensaje, 1;
    END;

    -- El código no se cambia: ya puede estar en pedidos y en la bitácora
    UPDATE dbo.Cupon
    SET Descripcion = NULLIF(LTRIM(RTRIM(@Descripcion)), N''),
        TipoDescuento = @TipoDescuento,
        Valor = @Valor,
        MontoMinimo = ISNULL(@MontoMinimo, 0),
        DescuentoMaximo = @DescuentoMaximo,
        IDCategoria = @IDCategoria,
        FechaInicio = @FechaInicio,
        FechaFin = @FechaFin,
        LimiteUsosTotal = @LimiteUsosTotal,
        LimiteUsosPorCliente = @LimiteUsosPorCliente,
        FechaActualizacion = SYSUTCDATETIME()
    WHERE IDCupon = @IDCupon;

    EXEC dbo.SP_Cupones_Obtener @IDCupon;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_CambiarEstado
    @IDUsuarioAccion INT,
    @IDCupon         INT,
    @Activo          BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 55001, N'El cupón no existe.', 1;

    UPDATE dbo.Cupon SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME() WHERE IDCupon = @IDCupon;

    EXEC dbo.SP_Cupones_Obtener @IDCupon;
END;
GO

-- Si el cupón ya se usó o está aplicado en algún carrito/checkout se desactiva; si no, se elimina
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Eliminar
    @IDUsuarioAccion INT,
    @IDCupon         INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @Resultado VARCHAR(12);

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 55001, N'El cupón no existe.', 1;

    IF EXISTS (SELECT 1 FROM dbo.CuponUso WHERE IDCupon = @IDCupon)
       OR EXISTS (SELECT 1 FROM dbo.Pedido WHERE IDCupon = @IDCupon)
       OR EXISTS (SELECT 1 FROM dbo.Checkout WHERE IDCupon = @IDCupon)
       OR EXISTS (SELECT 1 FROM dbo.Carrito WHERE IDCupon = @IDCupon)
    BEGIN
        UPDATE dbo.Cupon SET Activo = 0, FechaActualizacion = SYSUTCDATETIME() WHERE IDCupon = @IDCupon AND Activo = 1;
        SET @Resultado = 'DESACTIVADO';
    END
    ELSE
    BEGIN
        DELETE FROM dbo.Cupon WHERE IDCupon = @IDCupon;
        SET @Resultado = 'ELIMINADO';
    END;

    SELECT Resultado = @Resultado, IDCupon = @IDCupon;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Cupones_ListarUsos
    @IDCupon        INT,
    @Pagina         INT = 1,
    @TamanoPagina   INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 55001, N'El cupón no existe.', 1;

    SELECT cu.IDCuponUso, cu.IDPedido, p.NumeroPedido, cu.IDUsuario, Cliente = CONCAT(u.Nombres, N' ', u.Apellidos),
           cu.MontoDescuento, cu.Estado, cu.FechaUso, cu.FechaReversion,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.CuponUso cu
    INNER JOIN dbo.Pedido p  ON p.IDPedido = cu.IDPedido
    INNER JOIN dbo.Usuario u ON u.IDUsuario = cu.IDUsuario
    WHERE cu.IDCupon = @IDCupon
    ORDER BY cu.FechaUso DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
