/* =============================================================================
   ShopCart · 002 · Tablas de catálogo
   -----------------------------------------------------------------------------
   Categoria, Producto, ProductoImagen, Atributo, AtributoValor, Variante y
   VarianteAtributo.

   Cómo modelé las variantes:
   - El producto es lo que el cliente ve en el catálogo ("Playera básica").
   - La variante es lo que realmente se vende: tiene su SKU, precio y
     existencia propios ("PLA-BAS-M-NEG").
   - Los atributos (Talla, Color...) están normalizados en Atributo /
     AtributoValor, y VarianteAtributo dice qué valor tiene cada variante.
     Así no hay atributos escritos a mano de forma distinta ("Negro", "negro ")
     y una variante no puede tener dos tallas (UNIQUE IDVariante + IDAtributo).
   - Existencia es la física y Reservada lo apartado por checkouts en curso.
     Disponible = Existencia - Reservada se calcula en una columna persistida.
     El CHECK Reservada <= Existencia es la última barrera contra la sobreventa.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Categoria (
    IDCategoria         INT IDENTITY(1,1) NOT NULL,
    Nombre              NVARCHAR(100) NOT NULL,
    Descripcion         NVARCHAR(500) NULL,
    Activo              BIT           NOT NULL CONSTRAINT DF_Categoria_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)  NOT NULL CONSTRAINT DF_Categoria_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3)  NULL,
    CONSTRAINT PK_Categoria PRIMARY KEY (IDCategoria),
    CONSTRAINT UQ_Categoria_Nombre UNIQUE (Nombre),
    CONSTRAINT CK_Categoria_Nombre CHECK (LEN(LTRIM(Nombre)) > 0)
);
GO

CREATE TABLE dbo.Producto (
    IDProducto          INT IDENTITY(1,1) NOT NULL,
    IDCategoria         INT            NOT NULL,
    Nombre              NVARCHAR(150)  NOT NULL,
    Descripcion         NVARCHAR(2000) NULL,
    Marca               NVARCHAR(80)   NULL,
    Activo              BIT            NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)   NOT NULL CONSTRAINT DF_Producto_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3)   NULL,
    CONSTRAINT PK_Producto PRIMARY KEY (IDProducto),
    CONSTRAINT FK_Producto_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT CK_Producto_Nombre CHECK (LEN(LTRIM(Nombre)) > 0)
);
GO

CREATE TABLE dbo.ProductoImagen (
    IDProductoImagen    INT IDENTITY(1,1) NOT NULL,
    IDProducto          INT           NOT NULL,
    Url                 NVARCHAR(500) NOT NULL,
    TextoAlternativo    NVARCHAR(150) NULL,
    Orden               SMALLINT      NOT NULL CONSTRAINT DF_ProductoImagen_Orden DEFAULT (0),
    CONSTRAINT PK_ProductoImagen PRIMARY KEY (IDProductoImagen),
    CONSTRAINT FK_ProductoImagen_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto) ON DELETE CASCADE,
    CONSTRAINT UQ_ProductoImagen_Orden UNIQUE (IDProducto, Orden),
    CONSTRAINT CK_ProductoImagen_Url CHECK (Url LIKE 'https://%' OR Url LIKE 'http://%'),
    CONSTRAINT CK_ProductoImagen_Orden CHECK (Orden >= 0)
);
GO

CREATE TABLE dbo.Atributo (
    IDAtributo  INT IDENTITY(1,1) NOT NULL,
    Nombre      NVARCHAR(50) NOT NULL,
    CONSTRAINT PK_Atributo PRIMARY KEY (IDAtributo),
    CONSTRAINT UQ_Atributo_Nombre UNIQUE (Nombre),
    CONSTRAINT CK_Atributo_Nombre CHECK (LEN(LTRIM(Nombre)) > 0)
);
GO

CREATE TABLE dbo.AtributoValor (
    IDAtributoValor INT IDENTITY(1,1) NOT NULL,
    IDAtributo      INT          NOT NULL,
    Valor           NVARCHAR(50) NOT NULL,
    CONSTRAINT PK_AtributoValor PRIMARY KEY (IDAtributoValor),
    CONSTRAINT FK_AtributoValor_Atributo FOREIGN KEY (IDAtributo) REFERENCES dbo.Atributo (IDAtributo),
    CONSTRAINT UQ_AtributoValor_Valor UNIQUE (IDAtributo, Valor),
    -- Permite que VarianteAtributo apunte al par (valor, atributo) y no se mezclen
    CONSTRAINT UQ_AtributoValor_Par UNIQUE (IDAtributoValor, IDAtributo),
    CONSTRAINT CK_AtributoValor_Valor CHECK (LEN(LTRIM(Valor)) > 0)
);
GO

CREATE TABLE dbo.Variante (
    IDVariante          INT IDENTITY(1,1) NOT NULL,
    IDProducto          INT           NOT NULL,
    SKU                 VARCHAR(40)   NOT NULL,
    Precio              DECIMAL(12,2) NOT NULL,
    Existencia          INT           NOT NULL CONSTRAINT DF_Variante_Existencia DEFAULT (0),
    Reservada           INT           NOT NULL CONSTRAINT DF_Variante_Reservada DEFAULT (0),
    Disponible          AS (Existencia - Reservada) PERSISTED,
    Activo              BIT           NOT NULL CONSTRAINT DF_Variante_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(3)  NOT NULL CONSTRAINT DF_Variante_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3)  NULL,
    CONSTRAINT PK_Variante PRIMARY KEY (IDVariante),
    CONSTRAINT FK_Variante_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto),
    CONSTRAINT UQ_Variante_SKU UNIQUE (SKU),
    CONSTRAINT CK_Variante_SKU CHECK (LEN(SKU) >= 3 AND SKU NOT LIKE '%[^A-Za-z0-9-]%'),
    CONSTRAINT CK_Variante_Precio CHECK (Precio > 0),
    CONSTRAINT CK_Variante_Existencia CHECK (Existencia >= 0),
    CONSTRAINT CK_Variante_Reservada CHECK (Reservada >= 0 AND Reservada <= Existencia)
);
GO

CREATE TABLE dbo.VarianteAtributo (
    IDVarianteAtributo  INT IDENTITY(1,1) NOT NULL,
    IDVariante          INT NOT NULL,
    IDAtributo          INT NOT NULL,
    IDAtributoValor     INT NOT NULL,
    CONSTRAINT PK_VarianteAtributo PRIMARY KEY (IDVarianteAtributo),
    CONSTRAINT FK_VarianteAtributo_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante) ON DELETE CASCADE,
    CONSTRAINT FK_VarianteAtributo_AtributoValor FOREIGN KEY (IDAtributoValor, IDAtributo)
        REFERENCES dbo.AtributoValor (IDAtributoValor, IDAtributo),
    CONSTRAINT UQ_VarianteAtributo UNIQUE (IDVariante, IDAtributo)
);
GO
