/* =============================================================================
   ShopCart · 022 · SPs de administración de usuarios (solo Administrador)
   -----------------------------------------------------------------------------
   Los usuarios nunca se eliminan: se desactivan. Al desactivar a alguien se
   revocan todos sus refresh tokens, así no puede renovar su sesión.
   Un administrador no puede desactivarse ni quitarse el rol a sí mismo, para
   que el sistema nunca se quede sin nadie que lo administre por accidente.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Texto          NVARCHAR(100) = NULL,
    @Rol            VARCHAR(20)   = NULL,
    @Activo         BIT           = NULL,
    @Pagina         INT           = 1,
    @TamanoPagina   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    DECLARE @Patron NVARCHAR(320) = (SELECT Patron FROM dbo.FU_Sistema_PatronBusqueda(@Texto));

    SELECT u.IDUsuario, u.Correo, u.Nombres, u.Apellidos, u.Telefono, Rol = r.Codigo, u.Activo,
           u.FechaCreacion, u.FechaUltimoAcceso,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE (@Rol IS NULL OR r.Codigo = @Rol)
      AND (@Activo IS NULL OR u.Activo = @Activo)
      AND (@Patron IS NULL OR u.Correo LIKE @Patron OR u.Nombres LIKE @Patron OR u.Apellidos LIKE @Patron)
    ORDER BY u.FechaCreacion DESC, u.IDUsuario DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Obtener
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Crear
    @IDUsuarioAccion INT,
    @Correo          NVARCHAR(254),
    @HashContrasena  VARCHAR(255),
    @Nombres         NVARCHAR(100),
    @Apellidos       NVARCHAR(100),
    @Telefono        VARCHAR(20) = NULL,
    @Rol             VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDRol INT = (SELECT IDRol FROM dbo.Rol WHERE Codigo = @Rol);
    DECLARE @IDUsuario INT;
    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));

    IF @IDRol IS NULL
        THROW 51003, N'El rol indicado no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @Correo)
        THROW 51001, N'Ya existe una cuenta registrada con ese correo.', 1;

    BEGIN TRY
        INSERT INTO dbo.Usuario (IDRol, Correo, HashContrasena, Nombres, Apellidos, Telefono)
        VALUES (@IDRol, @Correo, @HashContrasena, LTRIM(RTRIM(@Nombres)), LTRIM(RTRIM(@Apellidos)), NULLIF(LTRIM(RTRIM(@Telefono)), ''));
        SET @IDUsuario = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 51001, N'Ya existe una cuenta registrada con ese correo.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuarioAccion INT,
    @IDUsuario       INT,
    @Nombres         NVARCHAR(100),
    @Apellidos       NVARCHAR(100),
    @Telefono        VARCHAR(20) = NULL,
    @Rol             VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDRol INT = (SELECT IDRol FROM dbo.Rol WHERE Codigo = @Rol);

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 51005, N'El usuario no existe.', 1;
    IF @IDRol IS NULL
        THROW 51003, N'El rol indicado no existe.', 1;
    IF @IDUsuario = @IDUsuarioAccion AND @Rol <> 'ADMIN'
        THROW 51004, N'No puedes quitarte a ti mismo el rol de administrador.', 1;

    UPDATE dbo.Usuario
    SET Nombres = LTRIM(RTRIM(@Nombres)),
        Apellidos = LTRIM(RTRIM(@Apellidos)),
        Telefono = NULLIF(LTRIM(RTRIM(@Telefono)), ''),
        IDRol = @IDRol,
        FechaActualizacion = SYSUTCDATETIME()
    WHERE IDUsuario = @IDUsuario;

    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarEstado
    @IDUsuarioAccion INT,
    @IDUsuario       INT,
    @Activo          BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 51005, N'El usuario no existe.', 1;
    IF @IDUsuario = @IDUsuarioAccion AND @Activo = 0
        THROW 51004, N'No puedes desactivar tu propia cuenta.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Usuario
        SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;

        IF @Activo = 0
            UPDATE dbo.TokenRefresco
            SET FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = 'USUARIO_DESACTIVADO'
            WHERE IDUsuario = @IDUsuario AND FechaRevocacion IS NULL;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Seguridad_ObtenerPerfil @IDUsuario;
END;
GO
