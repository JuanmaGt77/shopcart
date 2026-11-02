/* =============================================================================
   ShopCart · 001 · Tablas de seguridad
   -----------------------------------------------------------------------------
   Rol, Usuario y TokenRefresco.
   - Las contraseñas nunca se guardan, solo el hash (argon2id generado en la API).
   - Del refresh token tampoco se guarda el valor, solo su SHA-256. Si alguien
     lee esta tabla no puede usar los tokens.
   - Los usuarios no se borran: se desactivan (columna Activo).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Rol (
    IDRol           INT IDENTITY(1,1) NOT NULL,
    Codigo          VARCHAR(20)   NOT NULL,
    Nombre          NVARCHAR(50)  NOT NULL,
    Descripcion     NVARCHAR(200) NULL,
    CONSTRAINT PK_Rol PRIMARY KEY (IDRol),
    CONSTRAINT UQ_Rol_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Rol_Codigo CHECK (Codigo IN ('CLIENTE', 'OPERADOR', 'ADMIN'))
);
GO

CREATE TABLE dbo.Usuario (
    IDUsuario           INT IDENTITY(1,1) NOT NULL,
    IDRol               INT            NOT NULL,
    Correo              NVARCHAR(254)  NOT NULL,
    HashContrasena      VARCHAR(255)   NOT NULL,
    Nombres             NVARCHAR(100)  NOT NULL,
    Apellidos           NVARCHAR(100)  NOT NULL,
    Telefono            VARCHAR(20)    NULL,
    Activo              BIT            NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)   NOT NULL CONSTRAINT DF_Usuario_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3)   NULL,
    FechaUltimoAcceso   DATETIME2(3)   NULL,
    CONSTRAINT PK_Usuario PRIMARY KEY (IDUsuario),
    CONSTRAINT FK_Usuario_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol (IDRol),
    CONSTRAINT UQ_Usuario_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuario_Correo CHECK (Correo LIKE '%_@_%._%' AND Correo NOT LIKE '% %'),
    CONSTRAINT CK_Usuario_Nombres CHECK (LEN(LTRIM(Nombres)) > 0 AND LEN(LTRIM(Apellidos)) > 0),
    CONSTRAINT CK_Usuario_Telefono CHECK (Telefono IS NULL OR Telefono NOT LIKE '%[^0-9 +-]%')
);
GO

CREATE TABLE dbo.TokenRefresco (
    IDTokenRefresco     BIGINT IDENTITY(1,1) NOT NULL,
    IDUsuario           INT              NOT NULL,
    HashToken           CHAR(64)         NOT NULL,   -- SHA-256 en hexadecimal
    Familia             UNIQUEIDENTIFIER NOT NULL,   -- todos los tokens que salen de un mismo login
    FechaCreacion       DATETIME2(3)     NOT NULL CONSTRAINT DF_TokenRefresco_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaExpiracion     DATETIME2(3)     NOT NULL,
    FechaRevocacion     DATETIME2(3)     NULL,
    MotivoRevocacion    VARCHAR(25)      NULL,
    IDTokenReemplazo    BIGINT           NULL,       -- el token que lo sustituyó al rotar
    DireccionIP         VARCHAR(45)      NULL,
    AgenteUsuario       NVARCHAR(300)    NULL,
    CONSTRAINT PK_TokenRefresco PRIMARY KEY (IDTokenRefresco),
    CONSTRAINT FK_TokenRefresco_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_TokenRefresco_Reemplazo FOREIGN KEY (IDTokenReemplazo) REFERENCES dbo.TokenRefresco (IDTokenRefresco),
    CONSTRAINT UQ_TokenRefresco_HashToken UNIQUE (HashToken),
    CONSTRAINT CK_TokenRefresco_Hash CHECK (HashToken NOT LIKE '%[^0-9a-f]%'),
    CONSTRAINT CK_TokenRefresco_Fechas CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_TokenRefresco_Motivo CHECK (
        (FechaRevocacion IS NULL AND MotivoRevocacion IS NULL)
        OR (FechaRevocacion IS NOT NULL AND MotivoRevocacion IN ('ROTADO', 'LOGOUT', 'REUSO_DETECTADO', 'USUARIO_DESACTIVADO'))
    )
);
GO
