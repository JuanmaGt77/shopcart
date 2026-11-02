/* =============================================================================
   ShopCart · 004 · Tabla de cupones
   -----------------------------------------------------------------------------
   Cupon. El uso de cada cupón (CuponUso) se crea en el script de pedidos
   porque depende de la tabla Pedido.

   Reglas que protege la propia tabla:
   - Un porcentaje no puede pasar de 100.
   - UsosActuales nunca supera LimiteUsosTotal. Aunque dos checkouts intenten
     usar el último cupón al mismo tiempo, el segundo UPDATE choca con este CHECK
     (y antes de eso con el UPDATE condicional del SP).
   - IDCategoria NULL significa que aplica a todo el carrito.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Cupon (
    IDCupon                 INT IDENTITY(1,1) NOT NULL,
    IDCategoria             INT           NULL,
    Codigo                  VARCHAR(30)   NOT NULL,
    Descripcion             NVARCHAR(200) NULL,
    TipoDescuento           VARCHAR(10)   NOT NULL,          -- PORCENTAJE | MONTO
    Valor                   DECIMAL(12,2) NOT NULL,
    MontoMinimo             DECIMAL(12,2) NOT NULL CONSTRAINT DF_Cupon_MontoMinimo DEFAULT (0),
    DescuentoMaximo         DECIMAL(12,2) NULL,              -- tope para cupones de porcentaje
    FechaInicio             DATETIME2(3)  NOT NULL,
    FechaFin                DATETIME2(3)  NOT NULL,
    LimiteUsosTotal         INT           NULL,              -- NULL = sin límite
    LimiteUsosPorCliente    INT           NULL,
    UsosActuales            INT           NOT NULL CONSTRAINT DF_Cupon_UsosActuales DEFAULT (0),
    Activo                  BIT           NOT NULL CONSTRAINT DF_Cupon_Activo DEFAULT (1),
    FechaCreacion           DATETIME2(3)  NOT NULL CONSTRAINT DF_Cupon_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion      DATETIME2(3)  NULL,
    CONSTRAINT PK_Cupon PRIMARY KEY (IDCupon),
    CONSTRAINT FK_Cupon_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT UQ_Cupon_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Cupon_Codigo CHECK (LEN(Codigo) >= 3 AND Codigo NOT LIKE '%[^A-Za-z0-9_-]%'),
    CONSTRAINT CK_Cupon_Tipo CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO')),
    CONSTRAINT CK_Cupon_Valor CHECK (Valor > 0 AND (TipoDescuento <> 'PORCENTAJE' OR Valor <= 100)),
    CONSTRAINT CK_Cupon_MontoMinimo CHECK (MontoMinimo >= 0),
    CONSTRAINT CK_Cupon_DescuentoMaximo CHECK (DescuentoMaximo IS NULL OR DescuentoMaximo > 0),
    CONSTRAINT CK_Cupon_Vigencia CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Cupon_Limites CHECK ((LimiteUsosTotal IS NULL OR LimiteUsosTotal > 0)
                                       AND (LimiteUsosPorCliente IS NULL OR LimiteUsosPorCliente > 0)),
    CONSTRAINT CK_Cupon_Usos CHECK (UsosActuales >= 0 AND (LimiteUsosTotal IS NULL OR UsosActuales <= LimiteUsosTotal))
);
GO
