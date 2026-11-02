/* =============================================================================
   ShopCart · 010 · Tipos tabla (Table-Valued Parameters)
   -----------------------------------------------------------------------------
   Cuando un SP necesita recibir una lista (variantes de un producto, imágenes,
   líneas de una devolución) la recibe como un parámetro tabla tipado. Así no
   hay que mandar strings separados por coma ni armar SQL con concatenaciones.
   Nomenclatura: TT_Modulo_Nombre (TT = Table Type), siguiendo el mismo estilo
   del estándar de la empresa.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Variantes al crear un producto. "Clave" solo sirve para relacionar cada
-- variante con sus atributos dentro de la misma llamada.
CREATE TYPE dbo.TT_Catalogo_Variante AS TABLE (
    Clave               INT           NOT NULL PRIMARY KEY,
    SKU                 VARCHAR(40)   NOT NULL,
    Precio              DECIMAL(12,2) NOT NULL,
    ExistenciaInicial   INT           NOT NULL
);
GO

CREATE TYPE dbo.TT_Catalogo_AtributoVariante AS TABLE (
    ClaveVariante   INT          NOT NULL,
    Atributo        NVARCHAR(50) NOT NULL,
    Valor           NVARCHAR(50) NOT NULL,
    PRIMARY KEY (ClaveVariante, Atributo)
);
GO

CREATE TYPE dbo.TT_Catalogo_Imagen AS TABLE (
    Orden               SMALLINT      NOT NULL PRIMARY KEY,
    Url                 NVARCHAR(500) NOT NULL,
    TextoAlternativo    NVARCHAR(150) NULL
);
GO

CREATE TYPE dbo.TT_Devoluciones_Linea AS TABLE (
    IDPedidoDetalle INT NOT NULL PRIMARY KEY,
    Cantidad        INT NOT NULL
);
GO
