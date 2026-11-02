/* =============================================================================
   ShopCart · 003 · Tablas de clientes
   -----------------------------------------------------------------------------
   Departamento y Direccion.
   - Los 22 departamentos de Guatemala van en su propia tabla; el municipio queda
     como texto para no tener que mantener el catálogo completo de municipios.
   - Las direcciones se desactivan en lugar de borrarse porque los pedidos las
     referencian. Igual el pedido guarda una copia del texto de la dirección,
     así que editar una dirección nunca cambia un pedido ya hecho.
   - El índice filtrado garantiza una sola dirección predeterminada por cliente.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Departamento (
    IDDepartamento  INT IDENTITY(1,1) NOT NULL,
    Nombre          NVARCHAR(60) NOT NULL,
    CONSTRAINT PK_Departamento PRIMARY KEY (IDDepartamento),
    CONSTRAINT UQ_Departamento_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.Direccion (
    IDDireccion         INT IDENTITY(1,1) NOT NULL,
    IDUsuario           INT           NOT NULL,
    IDDepartamento      INT           NOT NULL,
    Alias               NVARCHAR(50)  NOT NULL,          -- "Casa", "Oficina"
    NombreDestinatario  NVARCHAR(150) NOT NULL,
    Telefono            VARCHAR(20)   NOT NULL,
    Linea1              NVARCHAR(200) NOT NULL,
    Linea2              NVARCHAR(200) NULL,
    Zona                TINYINT       NULL,
    Municipio           NVARCHAR(100) NOT NULL,
    CodigoPostal        VARCHAR(10)   NULL,
    Referencia          NVARCHAR(250) NULL,
    EsPredeterminada    BIT           NOT NULL CONSTRAINT DF_Direccion_EsPredeterminada DEFAULT (0),
    Activo              BIT           NOT NULL CONSTRAINT DF_Direccion_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)  NOT NULL CONSTRAINT DF_Direccion_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3)  NULL,
    CONSTRAINT PK_Direccion PRIMARY KEY (IDDireccion),
    CONSTRAINT FK_Direccion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Direccion_Departamento FOREIGN KEY (IDDepartamento) REFERENCES dbo.Departamento (IDDepartamento),
    CONSTRAINT CK_Direccion_Textos CHECK (LEN(LTRIM(Alias)) > 0 AND LEN(LTRIM(NombreDestinatario)) > 0
                                          AND LEN(LTRIM(Linea1)) > 0 AND LEN(LTRIM(Municipio)) > 0),
    CONSTRAINT CK_Direccion_Telefono CHECK (Telefono NOT LIKE '%[^0-9 +-]%' AND LEN(Telefono) >= 8),
    CONSTRAINT CK_Direccion_Zona CHECK (Zona IS NULL OR Zona BETWEEN 1 AND 25),
    CONSTRAINT CK_Direccion_CodigoPostal CHECK (CodigoPostal IS NULL OR CodigoPostal NOT LIKE '%[^0-9]%'),
    -- Una dirección desactivada no puede quedar como predeterminada
    CONSTRAINT CK_Direccion_Predeterminada CHECK (EsPredeterminada = 0 OR Activo = 1)
);
GO

CREATE UNIQUE INDEX UX_Direccion_Predeterminada
    ON dbo.Direccion (IDUsuario)
    WHERE EsPredeterminada = 1;
GO
