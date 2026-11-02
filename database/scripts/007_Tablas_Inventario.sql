/* =============================================================================
   ShopCart · 007 · Tablas de inventario
   -----------------------------------------------------------------------------
   TipoMovimiento y Kardex.

   El kardex es la fuente de verdad de la existencia física:
   - Cada fila guarda la cantidad con signo (+ entra, - sale), la existencia
     antes y después del movimiento, quién lo hizo, cuándo y por qué.
   - El CHECK CK_Kardex_Saldo obliga a que ExistenciaNueva = ExistenciaAnterior
     + Cantidad, y CK_Kardex_NoNegativo impide saldos negativos.
   - Variante.Existencia siempre debe ser igual a la suma del kardex. La vista
     VW_Inventario_ConciliacionKardex lo comprueba.
   - Las filas no se pueden modificar ni borrar (trigger en el script 013).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.TipoMovimiento (
    IDTipoMovimiento    INT IDENTITY(1,1) NOT NULL,
    Codigo              VARCHAR(30)  NOT NULL,
    Nombre              NVARCHAR(60) NOT NULL,
    Naturaleza          CHAR(1)      NOT NULL,   -- E = entrada (+), S = salida (-)
    EsManual            BIT          NOT NULL,   -- se puede registrar desde el módulo de inventario
    RequiereMotivo      BIT          NOT NULL,
    CONSTRAINT PK_TipoMovimiento PRIMARY KEY (IDTipoMovimiento),
    CONSTRAINT UQ_TipoMovimiento_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_TipoMovimiento_Naturaleza CHECK (Naturaleza IN ('E', 'S'))
);
GO

CREATE TABLE dbo.Kardex (
    IDKardex            BIGINT IDENTITY(1,1) NOT NULL,
    IDVariante          INT           NOT NULL,
    IDTipoMovimiento    INT           NOT NULL,
    Cantidad            INT           NOT NULL,   -- con signo
    ExistenciaAnterior  INT           NOT NULL,
    ExistenciaNueva     INT           NOT NULL,
    Motivo              NVARCHAR(250) NOT NULL,
    IDPedido            INT           NULL,
    IDDevolucion        INT           NULL,
    IDUsuario           INT           NULL,       -- NULL = proceso automático del sistema
    Fecha               DATETIME2(3)  NOT NULL CONSTRAINT DF_Kardex_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Kardex PRIMARY KEY (IDKardex),
    CONSTRAINT FK_Kardex_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_Kardex_TipoMovimiento FOREIGN KEY (IDTipoMovimiento) REFERENCES dbo.TipoMovimiento (IDTipoMovimiento),
    CONSTRAINT FK_Kardex_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Kardex_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion),
    CONSTRAINT FK_Kardex_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Kardex_Cantidad CHECK (Cantidad <> 0),
    CONSTRAINT CK_Kardex_Saldo CHECK (ExistenciaNueva = ExistenciaAnterior + Cantidad),
    CONSTRAINT CK_Kardex_NoNegativo CHECK (ExistenciaAnterior >= 0 AND ExistenciaNueva >= 0),
    CONSTRAINT CK_Kardex_Motivo CHECK (LEN(LTRIM(Motivo)) > 0)
);
GO
