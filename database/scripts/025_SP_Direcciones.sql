/* =============================================================================
   ShopCart · 025 · SPs de direcciones del cliente
   -----------------------------------------------------------------------------
   Todos reciben el IDUsuario que viene del token (nunca del body). Si la
   dirección existe pero es de otro cliente se responde 403 (error 50003); si no
   existe, 404. Así cambiar el ID en la URL no expone ni modifica nada ajeno.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_ListarDepartamentos
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDDepartamento, Nombre FROM dbo.Departamento ORDER BY Nombre;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Listar
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT d.IDDireccion, d.Alias, d.NombreDestinatario, d.Telefono, d.Linea1, d.Linea2, d.Zona, d.Municipio,
           d.IDDepartamento, Departamento = dep.Nombre, d.CodigoPostal, d.Referencia, d.EsPredeterminada,
           d.FechaCreacion, d.FechaActualizacion
    FROM dbo.Direccion d
    INNER JOIN dbo.Departamento dep ON dep.IDDepartamento = d.IDDepartamento
    WHERE d.IDUsuario = @IDUsuario AND d.Activo = 1
    ORDER BY d.EsPredeterminada DESC, d.FechaCreacion DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Obtener
    @IDUsuario   INT,
    @IDDireccion INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Duenio INT, @Activo BIT;
    SELECT @Duenio = IDUsuario, @Activo = Activo FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

    IF @Duenio IS NULL
        THROW 56001, N'La dirección no existe.', 1;
    IF @Duenio <> @IDUsuario
        THROW 50003, N'No tienes permiso para acceder a esta dirección.', 1;
    IF @Activo = 0
        THROW 56001, N'La dirección no existe.', 1;

    SELECT d.IDDireccion, d.Alias, d.NombreDestinatario, d.Telefono, d.Linea1, d.Linea2, d.Zona, d.Municipio,
           d.IDDepartamento, Departamento = dep.Nombre, d.CodigoPostal, d.Referencia, d.EsPredeterminada,
           d.FechaCreacion, d.FechaActualizacion
    FROM dbo.Direccion d
    INNER JOIN dbo.Departamento dep ON dep.IDDepartamento = d.IDDepartamento
    WHERE d.IDDireccion = @IDDireccion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
    @IDUsuario           INT,
    @Alias               NVARCHAR(50),
    @NombreDestinatario  NVARCHAR(150),
    @Telefono            VARCHAR(20),
    @Linea1              NVARCHAR(200),
    @Linea2              NVARCHAR(200) = NULL,
    @Zona                TINYINT       = NULL,
    @Municipio           NVARCHAR(100),
    @IDDepartamento      INT,
    @CodigoPostal        VARCHAR(10)   = NULL,
    @Referencia          NVARCHAR(250) = NULL,
    @EsPredeterminada    BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @IDDireccion INT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Departamento WHERE IDDepartamento = @IDDepartamento)
        THROW 56003, N'El departamento no existe.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- La primera dirección del cliente queda como predeterminada
        IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WITH (UPDLOCK, HOLDLOCK) WHERE IDUsuario = @IDUsuario AND Activo = 1)
            SET @EsPredeterminada = 1;

        IF @EsPredeterminada = 1
            UPDATE dbo.Direccion SET EsPredeterminada = 0 WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1;

        INSERT INTO dbo.Direccion (IDUsuario, IDDepartamento, Alias, NombreDestinatario, Telefono, Linea1, Linea2, Zona,
                                   Municipio, CodigoPostal, Referencia, EsPredeterminada)
        VALUES (@IDUsuario, @IDDepartamento, LTRIM(RTRIM(@Alias)), LTRIM(RTRIM(@NombreDestinatario)), LTRIM(RTRIM(@Telefono)),
                LTRIM(RTRIM(@Linea1)), NULLIF(LTRIM(RTRIM(@Linea2)), N''), @Zona, LTRIM(RTRIM(@Municipio)),
                NULLIF(LTRIM(RTRIM(@CodigoPostal)), ''), NULLIF(LTRIM(RTRIM(@Referencia)), N''), @EsPredeterminada);
        SET @IDDireccion = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Direcciones_Obtener @IDUsuario, @IDDireccion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDUsuario           INT,
    @IDDireccion         INT,
    @Alias               NVARCHAR(50),
    @NombreDestinatario  NVARCHAR(150),
    @Telefono            VARCHAR(20),
    @Linea1              NVARCHAR(200),
    @Linea2              NVARCHAR(200) = NULL,
    @Zona                TINYINT       = NULL,
    @Municipio           NVARCHAR(100),
    @IDDepartamento      INT,
    @CodigoPostal        VARCHAR(10)   = NULL,
    @Referencia          NVARCHAR(250) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Duenio INT, @Activo BIT;
    SELECT @Duenio = IDUsuario, @Activo = Activo FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

    IF @Duenio IS NULL
        THROW 56001, N'La dirección no existe.', 1;
    IF @Duenio <> @IDUsuario
        THROW 50003, N'No tienes permiso para modificar esta dirección.', 1;
    IF @Activo = 0
        THROW 56001, N'La dirección no existe.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Departamento WHERE IDDepartamento = @IDDepartamento)
        THROW 56003, N'El departamento no existe.', 1;

    UPDATE dbo.Direccion
    SET Alias = LTRIM(RTRIM(@Alias)),
        NombreDestinatario = LTRIM(RTRIM(@NombreDestinatario)),
        Telefono = LTRIM(RTRIM(@Telefono)),
        Linea1 = LTRIM(RTRIM(@Linea1)),
        Linea2 = NULLIF(LTRIM(RTRIM(@Linea2)), N''),
        Zona = @Zona,
        Municipio = LTRIM(RTRIM(@Municipio)),
        IDDepartamento = @IDDepartamento,
        CodigoPostal = NULLIF(LTRIM(RTRIM(@CodigoPostal)), ''),
        Referencia = NULLIF(LTRIM(RTRIM(@Referencia)), N''),
        FechaActualizacion = SYSUTCDATETIME()
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario;

    EXEC dbo.SP_Direcciones_Obtener @IDUsuario, @IDDireccion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_EstablecerPredeterminada
    @IDUsuario   INT,
    @IDDireccion INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Duenio INT, @Activo BIT;
    SELECT @Duenio = IDUsuario, @Activo = Activo FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

    IF @Duenio IS NULL
        THROW 56001, N'La dirección no existe.', 1;
    IF @Duenio <> @IDUsuario
        THROW 50003, N'No tienes permiso para modificar esta dirección.', 1;
    IF @Activo = 0
        THROW 56001, N'La dirección no existe.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.Direccion SET EsPredeterminada = 0 WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1;
        UPDATE dbo.Direccion SET EsPredeterminada = 1, FechaActualizacion = SYSUTCDATETIME() WHERE IDDireccion = @IDDireccion;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Direcciones_Obtener @IDUsuario, @IDDireccion;
END;
GO

-- Se desactiva (los pedidos la referencian). Si era la predeterminada, pasa a serlo la más reciente.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Eliminar
    @IDUsuario   INT,
    @IDDireccion INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuario;

    DECLARE @Duenio INT, @Activo BIT, @EraPredeterminada BIT;
    SELECT @Duenio = IDUsuario, @Activo = Activo, @EraPredeterminada = EsPredeterminada
    FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

    IF @Duenio IS NULL
        THROW 56001, N'La dirección no existe.', 1;
    IF @Duenio <> @IDUsuario
        THROW 50003, N'No tienes permiso para eliminar esta dirección.', 1;
    IF @Activo = 0
        THROW 56001, N'La dirección no existe.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Direccion
        SET Activo = 0, EsPredeterminada = 0, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDDireccion = @IDDireccion;

        IF @EraPredeterminada = 1
            UPDATE dbo.Direccion
            SET EsPredeterminada = 1
            WHERE IDDireccion = (SELECT TOP (1) IDDireccion FROM dbo.Direccion
                                 WHERE IDUsuario = @IDUsuario AND Activo = 1
                                 ORDER BY FechaCreacion DESC, IDDireccion DESC);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT Resultado = 'ELIMINADA', IDDireccion = @IDDireccion;
END;
GO
