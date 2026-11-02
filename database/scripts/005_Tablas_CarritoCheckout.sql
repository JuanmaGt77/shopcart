/* =============================================================================
   ShopCart · 005 · Tablas de carrito y checkout
   -----------------------------------------------------------------------------
   Carrito, CarritoDetalle, MetodoEnvio, Checkout y CheckoutDetalle.

   - Carrito de invitado: no tiene IDUsuario, se identifica por TokenInvitado
     (un GUID aleatorio). Al iniciar sesión se fusiona con el carrito del cliente.
   - Un cliente tiene como máximo un carrito ACTIVO (índice único filtrado).
   - El carrito no guarda precios: siempre muestra el precio vigente. El precio
     se congela cuando el cliente inicia el checkout.
   - Checkout = la "reserva de existencia" del glosario. Al iniciarlo se copian
     las líneas con su precio en CheckoutDetalle y se aparta la existencia por
     15 minutos (FechaExpiracion). Si paga, pasa a COMPLETADO; si no, un job lo
     marca EXPIRADO y devuelve las unidades.
   - Solo puede haber un checkout ACTIVO por carrito.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Carrito (
    IDCarrito               INT IDENTITY(1,1) NOT NULL,
    IDUsuario               INT              NULL,
    TokenInvitado           UNIQUEIDENTIFIER NULL,
    IDCupon                 INT              NULL,
    Estado                  VARCHAR(12)      NOT NULL CONSTRAINT DF_Carrito_Estado DEFAULT ('ACTIVO'),
    FechaCreacion           DATETIME2(3)     NOT NULL CONSTRAINT DF_Carrito_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaUltimaActividad    DATETIME2(3)     NOT NULL CONSTRAINT DF_Carrito_FechaUltimaActividad DEFAULT (SYSUTCDATETIME()),
    FechaCierre             DATETIME2(3)     NULL,
    CONSTRAINT PK_Carrito PRIMARY KEY (IDCarrito),
    CONSTRAINT FK_Carrito_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Carrito_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT CK_Carrito_Estado CHECK (Estado IN ('ACTIVO', 'CONVERTIDO', 'FUSIONADO')),
    CONSTRAINT CK_Carrito_Duenio CHECK (IDUsuario IS NOT NULL OR TokenInvitado IS NOT NULL),
    -- Los cupones requieren sesión (hay límite de usos por cliente)
    CONSTRAINT CK_Carrito_CuponConSesion CHECK (IDCupon IS NULL OR IDUsuario IS NOT NULL),
    CONSTRAINT CK_Carrito_Cierre CHECK ((Estado = 'ACTIVO' AND FechaCierre IS NULL) OR (Estado <> 'ACTIVO' AND FechaCierre IS NOT NULL))
);
GO

CREATE UNIQUE INDEX UX_Carrito_UsuarioActivo
    ON dbo.Carrito (IDUsuario)
    WHERE Estado = 'ACTIVO' AND IDUsuario IS NOT NULL;
GO

CREATE UNIQUE INDEX UX_Carrito_TokenInvitado
    ON dbo.Carrito (TokenInvitado)
    WHERE TokenInvitado IS NOT NULL;
GO

CREATE TABLE dbo.CarritoDetalle (
    IDCarritoDetalle    INT IDENTITY(1,1) NOT NULL,
    IDCarrito           INT          NOT NULL,
    IDVariante          INT          NOT NULL,
    Cantidad            INT          NOT NULL,
    FechaAgregado       DATETIME2(3) NOT NULL CONSTRAINT DF_CarritoDetalle_FechaAgregado DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion  DATETIME2(3) NULL,
    CONSTRAINT PK_CarritoDetalle PRIMARY KEY (IDCarritoDetalle),
    CONSTRAINT FK_CarritoDetalle_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito) ON DELETE CASCADE,
    CONSTRAINT FK_CarritoDetalle_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT UQ_CarritoDetalle UNIQUE (IDCarrito, IDVariante),
    CONSTRAINT CK_CarritoDetalle_Cantidad CHECK (Cantidad BETWEEN 1 AND 999)
);
GO

CREATE TABLE dbo.MetodoEnvio (
    IDMetodoEnvio       INT IDENTITY(1,1) NOT NULL,
    Codigo              VARCHAR(20)   NOT NULL,
    Nombre              NVARCHAR(80)  NOT NULL,
    Descripcion         NVARCHAR(200) NULL,
    Costo               DECIMAL(12,2) NOT NULL,
    DiasEstimadosMin    TINYINT       NOT NULL,
    DiasEstimadosMax    TINYINT       NOT NULL,
    Activo              BIT           NOT NULL CONSTRAINT DF_MetodoEnvio_Activo DEFAULT (1),
    CONSTRAINT PK_MetodoEnvio PRIMARY KEY (IDMetodoEnvio),
    CONSTRAINT UQ_MetodoEnvio_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_MetodoEnvio_Costo CHECK (Costo >= 0),
    CONSTRAINT CK_MetodoEnvio_Dias CHECK (DiasEstimadosMax >= DiasEstimadosMin)
);
GO

CREATE TABLE dbo.Checkout (
    IDCheckout          INT IDENTITY(1,1) NOT NULL,
    IDCarrito           INT           NOT NULL,
    IDUsuario           INT           NOT NULL,
    IDDireccion         INT           NOT NULL,
    IDMetodoEnvio       INT           NOT NULL,
    IDCupon             INT           NULL,
    Subtotal            DECIMAL(12,2) NOT NULL,
    Descuento           DECIMAL(12,2) NOT NULL CONSTRAINT DF_Checkout_Descuento DEFAULT (0),
    CostoEnvio          DECIMAL(12,2) NOT NULL,
    Total               DECIMAL(12,2) NOT NULL,
    Estado              VARCHAR(12)   NOT NULL CONSTRAINT DF_Checkout_Estado DEFAULT ('ACTIVO'),
    FechaCreacion       DATETIME2(3)  NOT NULL CONSTRAINT DF_Checkout_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaExpiracion     DATETIME2(3)  NOT NULL,
    FechaCierre         DATETIME2(3)  NULL,
    CONSTRAINT PK_Checkout PRIMARY KEY (IDCheckout),
    CONSTRAINT FK_Checkout_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_Checkout_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Checkout_Direccion FOREIGN KEY (IDDireccion) REFERENCES dbo.Direccion (IDDireccion),
    CONSTRAINT FK_Checkout_MetodoEnvio FOREIGN KEY (IDMetodoEnvio) REFERENCES dbo.MetodoEnvio (IDMetodoEnvio),
    CONSTRAINT FK_Checkout_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT CK_Checkout_Estado CHECK (Estado IN ('ACTIVO', 'COMPLETADO', 'EXPIRADO', 'CANCELADO')),
    -- El descuento nunca deja los productos en negativo y el total siempre cuadra
    CONSTRAINT CK_Checkout_Montos CHECK (Subtotal >= 0 AND Descuento >= 0 AND Descuento <= Subtotal
                                         AND CostoEnvio >= 0 AND Total = Subtotal - Descuento + CostoEnvio),
    CONSTRAINT CK_Checkout_Expiracion CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_Checkout_Cierre CHECK ((Estado = 'ACTIVO' AND FechaCierre IS NULL) OR (Estado <> 'ACTIVO' AND FechaCierre IS NOT NULL))
);
GO

CREATE UNIQUE INDEX UX_Checkout_CarritoActivo
    ON dbo.Checkout (IDCarrito)
    WHERE Estado = 'ACTIVO';
GO

CREATE TABLE dbo.CheckoutDetalle (
    IDCheckoutDetalle   INT IDENTITY(1,1) NOT NULL,
    IDCheckout          INT           NOT NULL,
    IDVariante          INT           NOT NULL,
    Cantidad            INT           NOT NULL,
    PrecioUnitario      DECIMAL(12,2) NOT NULL,   -- precio congelado al iniciar el checkout
    Subtotal            DECIMAL(12,2) NOT NULL,
    Descuento           DECIMAL(12,2) NOT NULL CONSTRAINT DF_CheckoutDetalle_Descuento DEFAULT (0),
    CONSTRAINT PK_CheckoutDetalle PRIMARY KEY (IDCheckoutDetalle),
    CONSTRAINT FK_CheckoutDetalle_Checkout FOREIGN KEY (IDCheckout) REFERENCES dbo.Checkout (IDCheckout),
    CONSTRAINT FK_CheckoutDetalle_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT UQ_CheckoutDetalle UNIQUE (IDCheckout, IDVariante),
    CONSTRAINT CK_CheckoutDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_CheckoutDetalle_Montos CHECK (PrecioUnitario > 0 AND Subtotal = Cantidad * PrecioUnitario
                                                AND Descuento >= 0 AND Descuento <= Subtotal)
);
GO
