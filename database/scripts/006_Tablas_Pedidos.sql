/* =============================================================================
   ShopCart · 006 · Tablas de pedidos
   -----------------------------------------------------------------------------
   EstadoPedido, EstadoPedidoTransicion, Pedido, PedidoDetalle,
   PedidoHistorialEstado, Pago, Devolucion, DevolucionDetalle y CuponUso.

   - El pedido nace cuando el pago se confirma, por eso su estado inicial es
     PAGADO. Antes de eso lo que existe es el Checkout con la reserva.
   - Las transiciones permitidas viven en EstadoPedidoTransicion. Un trigger
     (script 013) rechaza cualquier cambio de estado que no esté en esa tabla,
     aunque alguien haga un UPDATE directo en la base.
   - Pedido y PedidoDetalle guardan una "foto" de todo lo que el cliente vio al
     comprar: precio, descuento, SKU, nombre del producto, categoría y la
     dirección de entrega. Si después cambia un precio o se edita un producto,
     el pedido no se altera.
   - Los CHECK de montos garantizan que los totales siempre cuadren y que nunca
     se devuelva más cantidad o más dinero de lo vendido.
   - CuponUso tiene UNIQUE por pedido: un pedido solo puede tener un cupón.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.EstadoPedido (
    IDEstadoPedido      INT IDENTITY(1,1) NOT NULL,
    Codigo              VARCHAR(20)   NOT NULL,
    Nombre              NVARCHAR(50)  NOT NULL,
    Descripcion         NVARCHAR(200) NULL,
    EsInicial           BIT           NOT NULL CONSTRAINT DF_EstadoPedido_EsInicial DEFAULT (0),
    EsFinal             BIT           NOT NULL CONSTRAINT DF_EstadoPedido_EsFinal DEFAULT (0),
    CuentaComoVenta     BIT           NOT NULL,   -- si los reportes lo toman en cuenta
    Orden               TINYINT       NOT NULL,
    CONSTRAINT PK_EstadoPedido PRIMARY KEY (IDEstadoPedido),
    CONSTRAINT UQ_EstadoPedido_Codigo UNIQUE (Codigo)
);
GO

-- Solo un estado puede ser el inicial
CREATE UNIQUE INDEX UX_EstadoPedido_Inicial ON dbo.EstadoPedido (EsInicial) WHERE EsInicial = 1;
GO

CREATE TABLE dbo.EstadoPedidoTransicion (
    IDEstadoPedidoTransicion    INT IDENTITY(1,1) NOT NULL,
    IDEstadoOrigen              INT NOT NULL,
    IDEstadoDestino             INT NOT NULL,
    CONSTRAINT PK_EstadoPedidoTransicion PRIMARY KEY (IDEstadoPedidoTransicion),
    CONSTRAINT FK_EstadoPedidoTransicion_Origen FOREIGN KEY (IDEstadoOrigen) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_EstadoPedidoTransicion_Destino FOREIGN KEY (IDEstadoDestino) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT UQ_EstadoPedidoTransicion UNIQUE (IDEstadoOrigen, IDEstadoDestino),
    CONSTRAINT CK_EstadoPedidoTransicion CHECK (IDEstadoOrigen <> IDEstadoDestino)
);
GO

CREATE TABLE dbo.Pedido (
    IDPedido                INT IDENTITY(1,1) NOT NULL,
    NumeroPedido            AS (CASE WHEN IDPedido < 1000000
                                     THEN 'SC-' + RIGHT('000000' + CAST(IDPedido AS VARCHAR(10)), 6)
                                     ELSE 'SC-' + CAST(IDPedido AS VARCHAR(10)) END) PERSISTED,
    IDUsuario               INT            NOT NULL,
    IDCheckout              INT            NOT NULL,
    IDEstadoPedido          INT            NOT NULL,
    IDMetodoEnvio           INT            NOT NULL,
    IDDireccion             INT            NOT NULL,
    IDCupon                 INT            NULL,
    -- Copia de la entrega al momento de la compra
    EntregaDestinatario     NVARCHAR(150)  NOT NULL,
    EntregaTelefono         VARCHAR(20)    NOT NULL,
    EntregaDireccion        NVARCHAR(700)  NOT NULL,
    MetodoEnvioNombre       NVARCHAR(80)   NOT NULL,
    CodigoCupon             VARCHAR(30)    NULL,
    -- Montos congelados (quetzales, IVA incluido)
    Subtotal                DECIMAL(12,2)  NOT NULL,
    Descuento               DECIMAL(12,2)  NOT NULL,
    CostoEnvio              DECIMAL(12,2)  NOT NULL,
    Total                   DECIMAL(12,2)  NOT NULL,
    BaseImponible           DECIMAL(12,2)  NOT NULL,
    MontoIVA                DECIMAL(12,2)  NOT NULL,
    MontoDevuelto           DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Pedido_MontoDevuelto DEFAULT (0),
    ComentarioEstado        NVARCHAR(250)  NULL,    -- comentario del último cambio; el trigger lo copia al historial
    ClaveIdempotencia       VARCHAR(100)   NOT NULL,
    FechaCreacion           DATETIME2(3)   NOT NULL CONSTRAINT DF_Pedido_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion      DATETIME2(3)   NULL,
    -- Fecha del pedido en hora de Guatemala (UTC-6, sin horario de verano) para agrupar reportes
    FechaLocal              AS (CAST(DATEADD(HOUR, -6, FechaCreacion) AS DATE)) PERSISTED,
    CONSTRAINT PK_Pedido PRIMARY KEY (IDPedido),
    CONSTRAINT FK_Pedido_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Pedido_Checkout FOREIGN KEY (IDCheckout) REFERENCES dbo.Checkout (IDCheckout),
    CONSTRAINT FK_Pedido_EstadoPedido FOREIGN KEY (IDEstadoPedido) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_Pedido_MetodoEnvio FOREIGN KEY (IDMetodoEnvio) REFERENCES dbo.MetodoEnvio (IDMetodoEnvio),
    CONSTRAINT FK_Pedido_Direccion FOREIGN KEY (IDDireccion) REFERENCES dbo.Direccion (IDDireccion),
    CONSTRAINT FK_Pedido_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    -- Un checkout genera como máximo un pedido: es la base de la idempotencia del pago
    CONSTRAINT UQ_Pedido_Checkout UNIQUE (IDCheckout),
    CONSTRAINT UQ_Pedido_Idempotencia UNIQUE (IDUsuario, ClaveIdempotencia),
    CONSTRAINT CK_Pedido_Montos CHECK (Subtotal >= 0 AND Descuento >= 0 AND Descuento <= Subtotal
                                       AND CostoEnvio >= 0 AND Total = Subtotal - Descuento + CostoEnvio),
    CONSTRAINT CK_Pedido_IVA CHECK (MontoIVA >= 0 AND BaseImponible >= 0 AND BaseImponible + MontoIVA = Total),
    CONSTRAINT CK_Pedido_MontoDevuelto CHECK (MontoDevuelto >= 0 AND MontoDevuelto <= Total),
    CONSTRAINT CK_Pedido_Cupon CHECK ((IDCupon IS NULL AND CodigoCupon IS NULL) OR (IDCupon IS NOT NULL AND CodigoCupon IS NOT NULL)),
    CONSTRAINT CK_Pedido_Idempotencia CHECK (LEN(ClaveIdempotencia) >= 8)
);
GO

CREATE UNIQUE INDEX UX_Pedido_NumeroPedido ON dbo.Pedido (NumeroPedido);
GO

CREATE TABLE dbo.PedidoDetalle (
    IDPedidoDetalle         INT IDENTITY(1,1) NOT NULL,
    IDPedido                INT            NOT NULL,
    IDVariante              INT            NOT NULL,
    IDCategoria             INT            NOT NULL,   -- categoría al momento de la venta (para reportes)
    SKU                     VARCHAR(40)    NOT NULL,
    NombreProducto          NVARCHAR(150)  NOT NULL,
    DescripcionVariante     NVARCHAR(200)  NULL,       -- "Color: Negro / Talla: M"
    Cantidad                INT            NOT NULL,
    PrecioUnitario          DECIMAL(12,2)  NOT NULL,
    Subtotal                DECIMAL(12,2)  NOT NULL,
    Descuento               DECIMAL(12,2)  NOT NULL CONSTRAINT DF_PedidoDetalle_Descuento DEFAULT (0),
    Total                   DECIMAL(12,2)  NOT NULL,
    CantidadDevuelta        INT            NOT NULL CONSTRAINT DF_PedidoDetalle_CantidadDevuelta DEFAULT (0),
    MontoDevuelto           DECIMAL(12,2)  NOT NULL CONSTRAINT DF_PedidoDetalle_MontoDevuelto DEFAULT (0),
    CONSTRAINT PK_PedidoDetalle PRIMARY KEY (IDPedidoDetalle),
    CONSTRAINT FK_PedidoDetalle_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_PedidoDetalle_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_PedidoDetalle_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT UQ_PedidoDetalle UNIQUE (IDPedido, IDVariante),
    CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_PedidoDetalle_Montos CHECK (PrecioUnitario > 0 AND Subtotal = Cantidad * PrecioUnitario
                                              AND Descuento >= 0 AND Descuento <= Subtotal AND Total = Subtotal - Descuento),
    -- No se puede devolver más de lo vendido en la línea
    CONSTRAINT CK_PedidoDetalle_Devolucion CHECK (CantidadDevuelta >= 0 AND CantidadDevuelta <= Cantidad
                                                  AND MontoDevuelto >= 0 AND MontoDevuelto <= Total)
);
GO

CREATE TABLE dbo.PedidoHistorialEstado (
    IDPedidoHistorialEstado BIGINT IDENTITY(1,1) NOT NULL,
    IDPedido                INT           NOT NULL,
    IDEstadoAnterior        INT           NULL,     -- NULL cuando el pedido se crea
    IDEstadoNuevo           INT           NOT NULL,
    IDUsuario               INT           NULL,     -- NULL si el cambio lo hizo un proceso del sistema
    Comentario              NVARCHAR(250) NULL,
    Fecha                   DATETIME2(3)  NOT NULL CONSTRAINT DF_PedidoHistorialEstado_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_PedidoHistorialEstado PRIMARY KEY (IDPedidoHistorialEstado),
    CONSTRAINT FK_PedidoHistorialEstado_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Anterior FOREIGN KEY (IDEstadoAnterior) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Nuevo FOREIGN KEY (IDEstadoNuevo) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario)
);
GO

CREATE TABLE dbo.Pago (
    IDPago                  INT IDENTITY(1,1) NOT NULL,
    IDPedido                INT           NOT NULL,
    Metodo                  VARCHAR(20)   NOT NULL CONSTRAINT DF_Pago_Metodo DEFAULT ('TARJETA'),
    MarcaTarjeta            VARCHAR(20)   NULL,
    UltimosDigitos          CHAR(4)       NULL,     -- nunca se guarda el número completo
    CodigoAutorizacion      VARCHAR(50)   NOT NULL,
    Monto                   DECIMAL(12,2) NOT NULL,
    MontoReembolsado        DECIMAL(12,2) NOT NULL CONSTRAINT DF_Pago_MontoReembolsado DEFAULT (0),
    Estado                  VARCHAR(20)   NOT NULL CONSTRAINT DF_Pago_Estado DEFAULT ('APROBADO'),
    FechaPago               DATETIME2(3)  NOT NULL CONSTRAINT DF_Pago_FechaPago DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion      DATETIME2(3)  NULL,
    CONSTRAINT PK_Pago PRIMARY KEY (IDPago),
    CONSTRAINT FK_Pago_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    -- Un pedido tiene un solo cobro: aunque el cliente presione dos veces, no hay doble cargo
    CONSTRAINT UQ_Pago_Pedido UNIQUE (IDPedido),
    CONSTRAINT CK_Pago_Metodo CHECK (Metodo IN ('TARJETA')),
    CONSTRAINT CK_Pago_Digitos CHECK (UltimosDigitos IS NULL OR UltimosDigitos NOT LIKE '%[^0-9]%'),
    CONSTRAINT CK_Pago_Montos CHECK (Monto >= 0 AND MontoReembolsado >= 0 AND MontoReembolsado <= Monto),
    CONSTRAINT CK_Pago_Estado CHECK (Estado IN ('APROBADO', 'REEMBOLSO_PARCIAL', 'REEMBOLSADO'))
);
GO

CREATE TABLE dbo.Devolucion (
    IDDevolucion            INT IDENTITY(1,1) NOT NULL,
    IDPedido                INT           NOT NULL,
    IDUsuario               INT           NOT NULL,   -- quien la registró (operador o administrador)
    Motivo                  NVARCHAR(250) NOT NULL,
    MontoReembolso          DECIMAL(12,2) NOT NULL,
    IncluyeEnvio            BIT           NOT NULL CONSTRAINT DF_Devolucion_IncluyeEnvio DEFAULT (0),
    Fecha                   DATETIME2(3)  NOT NULL CONSTRAINT DF_Devolucion_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Devolucion PRIMARY KEY (IDDevolucion),
    CONSTRAINT FK_Devolucion_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Devolucion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Devolucion_Motivo CHECK (LEN(LTRIM(Motivo)) > 0),
    CONSTRAINT CK_Devolucion_Monto CHECK (MontoReembolso >= 0)
);
GO

CREATE TABLE dbo.DevolucionDetalle (
    IDDevolucionDetalle     INT IDENTITY(1,1) NOT NULL,
    IDDevolucion            INT           NOT NULL,
    IDPedidoDetalle         INT           NOT NULL,
    Cantidad                INT           NOT NULL,
    MontoReembolso          DECIMAL(12,2) NOT NULL,
    CONSTRAINT PK_DevolucionDetalle PRIMARY KEY (IDDevolucionDetalle),
    CONSTRAINT FK_DevolucionDetalle_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion),
    CONSTRAINT FK_DevolucionDetalle_PedidoDetalle FOREIGN KEY (IDPedidoDetalle) REFERENCES dbo.PedidoDetalle (IDPedidoDetalle),
    CONSTRAINT UQ_DevolucionDetalle UNIQUE (IDDevolucion, IDPedidoDetalle),
    CONSTRAINT CK_DevolucionDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_DevolucionDetalle_Monto CHECK (MontoReembolso >= 0)
);
GO

CREATE TABLE dbo.CuponUso (
    IDCuponUso          INT IDENTITY(1,1) NOT NULL,
    IDCupon             INT           NOT NULL,
    IDUsuario           INT           NOT NULL,
    IDPedido            INT           NOT NULL,
    MontoDescuento      DECIMAL(12,2) NOT NULL,
    Estado              VARCHAR(10)   NOT NULL CONSTRAINT DF_CuponUso_Estado DEFAULT ('APLICADO'),
    FechaUso            DATETIME2(3)  NOT NULL CONSTRAINT DF_CuponUso_FechaUso DEFAULT (SYSUTCDATETIME()),
    FechaReversion      DATETIME2(3)  NULL,
    CONSTRAINT PK_CuponUso PRIMARY KEY (IDCuponUso),
    CONSTRAINT FK_CuponUso_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT FK_CuponUso_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_CuponUso_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT UQ_CuponUso_Pedido UNIQUE (IDPedido),     -- un cupón por pedido
    CONSTRAINT CK_CuponUso_Monto CHECK (MontoDescuento >= 0),
    CONSTRAINT CK_CuponUso_Estado CHECK (Estado IN ('APLICADO', 'REVERTIDO')),
    CONSTRAINT CK_CuponUso_Reversion CHECK ((Estado = 'APLICADO' AND FechaReversion IS NULL) OR (Estado = 'REVERTIDO' AND FechaReversion IS NOT NULL))
);
GO
