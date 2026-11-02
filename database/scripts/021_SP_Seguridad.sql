/* =============================================================================
   ShopCart · 021 · SPs de seguridad (registro, login y refresh tokens)
   -----------------------------------------------------------------------------
   El hash de la contraseña lo genera y lo verifica la API (argon2id). La base
   solo guarda el hash y los hashes SHA-256 de los refresh tokens.

   Rotación de refresh tokens:
   - Cada refresh revoca el token usado y crea uno nuevo de la misma "familia".
   - Si alguien presenta un token que ya fue rotado, es señal de que lo robaron:
     se revoca toda la familia y la sesión se cierra en todos lados.
   - Excepción: si el token se rotó hace menos de unos segundos (dos pestañas
     refrescando a la vez) solo se rechaza, sin matar la sesión.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_ObtenerPerfil
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 51005, N'El usuario no existe.', 1;

    SELECT u.IDUsuario, u.Correo, u.Nombres, u.Apellidos, u.Telefono, Rol = r.Codigo, u.Activo,
           u.FechaCreacion, u.FechaUltimoAcceso
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_RegistrarCliente
    @Correo          NVARCHAR(254),
    @HashContrasena  VARCHAR(255),
    @Nombres         NVARCHAR(100),
    @Apellidos       NVARCHAR(100),
    @Telefono        VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- Registro público: no hay un usuario operando todavía
    EXEC dbo.SP_Sistema_EstablecerUsuario NULL;

    DECLARE @IDUsuario INT;
    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));

    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @Correo)
        THROW 51001, N'Ya existe una cuenta registrada con ese correo.', 1;

    BEGIN TRY
        INSERT INTO dbo.Usuario (IDRol, Correo, HashContrasena, Nombres, Apellidos, Telefono)
        SELECT r.IDRol, @Correo, @HashContrasena, LTRIM(RTRIM(@Nombres)), LTRIM(RTRIM(@Apellidos)), NULLIF(LTRIM(RTRIM(@Telefono)), '')
        FROM dbo.Rol r
        WHERE r.Codigo = 'CLIENTE';

        SET @IDUsuario = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        -- Dos registros simultáneos con el mismo correo: gana uno, el otro choca con el UNIQUE
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 51001, N'Ya existe una cuenta registrada con ese correo.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO

-- Devuelve el hash para que la API verifique la contraseña
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_ObtenerUsuarioParaLogin
    @Correo NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.IDUsuario, u.Correo, u.HashContrasena, u.Nombres, u.Apellidos, Rol = r.Codigo, u.Activo
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.Correo = LOWER(LTRIM(RTRIM(@Correo)));
END;
GO

-- Registra el inicio de sesión y guarda el primer refresh token de la familia
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_IniciarSesion
    @IDUsuario          INT,
    @HashToken          CHAR(64),
    @Familia            UNIQUEIDENTIFIER,
    @FechaExpiracion    DATETIME2(3),
    @DireccionIP        VARCHAR(45) = NULL,
    @AgenteUsuario      NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario AND Activo = 1)
        THROW 51002, N'Tu cuenta está desactivada. Comunícate con la tienda.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Usuario SET FechaUltimoAcceso = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario;

        INSERT INTO dbo.TokenRefresco (IDUsuario, HashToken, Familia, FechaExpiracion, DireccionIP, AgenteUsuario)
        VALUES (@IDUsuario, LOWER(@HashToken), @Familia, @FechaExpiracion, @DireccionIP, LEFT(@AgenteUsuario, 300));

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO

-- Rota el refresh token. Devuelve una fila con Resultado:
-- OK | TOKEN_INVALIDO | TOKEN_EXPIRADO | TOKEN_YA_ROTADO | REUSO_DETECTADO | USUARIO_INACTIVO
-- No usa THROW para los rechazos porque algunos (reuso) deben confirmar la revocación.
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_RotarTokenRefresco
    @HashTokenActual        CHAR(64),
    @HashTokenNuevo         CHAR(64),
    @FechaExpiracionNueva   DATETIME2(3),
    @DireccionIP            VARCHAR(45) = NULL,
    @AgenteUsuario          NVARCHAR(300) = NULL,
    @SegundosGracia         INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDToken BIGINT, @IDUsuario INT, @Familia UNIQUEIDENTIFIER, @Expira DATETIME2(3),
            @Revocado DATETIME2(3), @Motivo VARCHAR(25), @Activo BIT, @NuevoID BIGINT,
            @Resultado VARCHAR(20);

    EXEC dbo.SP_Sistema_EstablecerUsuario NULL;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @IDToken = t.IDTokenRefresco, @IDUsuario = t.IDUsuario, @Familia = t.Familia,
               @Expira = t.FechaExpiracion, @Revocado = t.FechaRevocacion, @Motivo = t.MotivoRevocacion,
               @Activo = u.Activo
        FROM dbo.TokenRefresco t WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.Usuario u ON u.IDUsuario = t.IDUsuario
        WHERE t.HashToken = LOWER(@HashTokenActual);

        IF @IDToken IS NULL
            SET @Resultado = 'TOKEN_INVALIDO';
        ELSE IF @Revocado IS NOT NULL
        BEGIN
            IF @Motivo = 'ROTADO' AND DATEDIFF(SECOND, @Revocado, @Ahora) <= @SegundosGracia
                SET @Resultado = 'TOKEN_YA_ROTADO';
            ELSE
            BEGIN
                -- Se usó un token viejo: alguien más lo tiene. Se cierra toda la familia.
                UPDATE dbo.TokenRefresco
                SET FechaRevocacion = @Ahora, MotivoRevocacion = 'REUSO_DETECTADO'
                WHERE Familia = @Familia AND FechaRevocacion IS NULL;
                SET @Resultado = 'REUSO_DETECTADO';
            END;
        END
        ELSE IF @Expira <= @Ahora
            SET @Resultado = 'TOKEN_EXPIRADO';
        ELSE IF @Activo = 0
        BEGIN
            UPDATE dbo.TokenRefresco
            SET FechaRevocacion = @Ahora, MotivoRevocacion = 'USUARIO_DESACTIVADO'
            WHERE Familia = @Familia AND FechaRevocacion IS NULL;
            SET @Resultado = 'USUARIO_INACTIVO';
        END
        ELSE
        BEGIN
            INSERT INTO dbo.TokenRefresco (IDUsuario, HashToken, Familia, FechaExpiracion, DireccionIP, AgenteUsuario)
            VALUES (@IDUsuario, LOWER(@HashTokenNuevo), @Familia, @FechaExpiracionNueva, @DireccionIP, LEFT(@AgenteUsuario, 300));
            SET @NuevoID = SCOPE_IDENTITY();

            UPDATE dbo.TokenRefresco
            SET FechaRevocacion = @Ahora, MotivoRevocacion = 'ROTADO', IDTokenReemplazo = @NuevoID
            WHERE IDTokenRefresco = @IDToken;

            SET @Resultado = 'OK';
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT Resultado = @Resultado,
           IDUsuario = CASE WHEN @Resultado = 'OK' THEN u.IDUsuario END,
           Correo    = CASE WHEN @Resultado = 'OK' THEN u.Correo END,
           Nombres   = CASE WHEN @Resultado = 'OK' THEN u.Nombres END,
           Apellidos = CASE WHEN @Resultado = 'OK' THEN u.Apellidos END,
           Rol       = CASE WHEN @Resultado = 'OK' THEN r.Codigo END
    FROM (SELECT 1 AS x) d
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = @IDUsuario
    LEFT JOIN dbo.Rol r     ON r.IDRol = u.IDRol;
END;
GO

-- Cierra la sesión: revoca el token presentado y todos los de su familia
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_CerrarSesion
    @HashToken CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Familia UNIQUEIDENTIFIER =
        (SELECT Familia FROM dbo.TokenRefresco WHERE HashToken = LOWER(@HashToken));

    IF @Familia IS NOT NULL
        UPDATE dbo.TokenRefresco
        SET FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = 'LOGOUT'
        WHERE Familia = @Familia AND FechaRevocacion IS NULL;

    SELECT SesionCerrada = CAST(CASE WHEN @Familia IS NULL THEN 0 ELSE 1 END AS BIT);
END;
GO

-- La API lo consulta (con caché corta) para cortar el acceso de usuarios desactivados
CREATE OR ALTER PROCEDURE dbo.SP_Seguridad_ObtenerEstadoUsuario
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.IDUsuario, u.Activo, Rol = r.Codigo
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END;
GO
