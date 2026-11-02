/* =============================================================================
   ShopCart · 020 · SPs del sistema
   -----------------------------------------------------------------------------
   Convenciones que siguen todos los SPs del proyecto:
   - SET XACT_ABORT ON: ante cualquier error la transacción completa se revierte.
   - Los SPs que modifican datos empiezan llamando a SP_Sistema_EstablecerUsuario
     para que los triggers sepan qué usuario hizo el cambio (bitácora/historial).
   - Los errores de negocio se lanzan con THROW y un número propio (50000+). La
     API traduce cada número a su código HTTP (ver README, catálogo de errores).
   - Ningún SP arma SQL dinámico. Los filtros opcionales se resuelven con
     condiciones (@Param IS NULL OR Columna = @Param) y OPTION (RECOMPILE).
   - Los SPs marcados como "interno" solo los llaman otros SPs; el usuario de la
     aplicación tiene DENY EXECUTE sobre ellos (script 040).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Interno. Guarda en el contexto de la sesión el usuario que está operando.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_EstablecerUsuario
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
END;
GO

-- Lo usa el endpoint de salud de la API para comprobar la conexión
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_Salud
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Estado = 'OK', BaseDatos = DB_NAME(), FechaServidorUtc = SYSUTCDATETIME();
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Sistema_ListarParametros
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.Clave, p.Valor, p.ValorMinimo, p.ValorMaximo, p.Descripcion, p.FechaActualizacion,
           ActualizadoPor = CASE WHEN u.IDUsuario IS NULL THEN NULL ELSE CONCAT(u.Nombres, N' ', u.Apellidos) END
    FROM dbo.ParametroSistema p
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = p.IDUsuarioActualizacion
    ORDER BY p.Clave;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Sistema_ActualizarParametro
    @IDUsuarioAccion INT,
    @Clave           VARCHAR(50),
    @Valor           INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @Minimo INT, @Maximo INT, @Mensaje NVARCHAR(300);
    SELECT @Minimo = ValorMinimo, @Maximo = ValorMaximo FROM dbo.ParametroSistema WHERE Clave = @Clave;

    IF @Minimo IS NULL
        THROW 60004, N'El parámetro no existe.', 1;
    IF @Valor NOT BETWEEN @Minimo AND @Maximo
    BEGIN
        SET @Mensaje = CONCAT(N'El valor de ', @Clave, N' debe estar entre ', @Minimo, N' y ', @Maximo, N'.');
        THROW 60003, @Mensaje, 1;
    END;

    UPDATE dbo.ParametroSistema
    SET Valor = @Valor, FechaActualizacion = SYSUTCDATETIME(), IDUsuarioActualizacion = @IDUsuarioAccion
    WHERE Clave = @Clave;

    SELECT Clave, Valor, ValorMinimo, ValorMaximo, Descripcion, FechaActualizacion
    FROM dbo.ParametroSistema WHERE Clave = @Clave;
END;
GO
