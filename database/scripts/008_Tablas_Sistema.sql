/* =============================================================================
   ShopCart · 008 · Tablas del sistema
   -----------------------------------------------------------------------------
   Bitacora y ParametroSistema.

   Bitacora:
   - La llenan triggers (script 013), así ningún cambio en productos, precios,
     existencias, cupones o estados de pedido se queda sin registrar, venga de
     la API o de alguien conectado directo a la base.
   - Guarda valor anterior y nuevo en JSON (validado con ISJSON).
   - Es de solo inserción: un trigger INSTEAD OF bloquea UPDATE y DELETE, y el
     usuario de la aplicación no tiene permisos directos sobre ninguna tabla.

   ParametroSistema: valores configurables sin tocar código (duración de la
   reserva, horas para considerar un carrito abandonado, etc.).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE TABLE dbo.Bitacora (
    IDBitacora      BIGINT IDENTITY(1,1) NOT NULL,
    Modulo          VARCHAR(20)    NOT NULL,
    Entidad         VARCHAR(40)    NOT NULL,
    IDEntidad       VARCHAR(40)    NOT NULL,
    Accion          VARCHAR(20)    NOT NULL,
    ValorAnterior   NVARCHAR(MAX)  NULL,
    ValorNuevo      NVARCHAR(MAX)  NULL,
    IDUsuario       INT            NULL,      -- usuario de la aplicación que hizo el cambio
    UsuarioBD       NVARCHAR(128)  NOT NULL CONSTRAINT DF_Bitacora_UsuarioBD DEFAULT (ORIGINAL_LOGIN()),
    Fecha           DATETIME2(3)   NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Bitacora PRIMARY KEY (IDBitacora),
    CONSTRAINT FK_Bitacora_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Bitacora_Modulo CHECK (Modulo IN ('CATALOGO', 'INVENTARIO', 'CUPONES', 'PEDIDOS', 'USUARIOS', 'SISTEMA')),
    CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN ('CREAR', 'MODIFICAR', 'ACTIVAR', 'DESACTIVAR', 'ELIMINAR',
                                                    'CAMBIO_PRECIO', 'CAMBIO_EXISTENCIA', 'CAMBIO_ESTADO')),
    CONSTRAINT CK_Bitacora_Json CHECK ((ValorAnterior IS NULL OR ISJSON(ValorAnterior) = 1)
                                       AND (ValorNuevo IS NULL OR ISJSON(ValorNuevo) = 1))
);
GO

CREATE TABLE dbo.ParametroSistema (
    IDParametroSistema      INT IDENTITY(1,1) NOT NULL,
    Clave                   VARCHAR(50)   NOT NULL,
    Valor                   INT           NOT NULL,
    ValorMinimo             INT           NOT NULL,
    ValorMaximo             INT           NOT NULL,
    Descripcion             NVARCHAR(250) NOT NULL,
    FechaActualizacion      DATETIME2(3)  NULL,
    IDUsuarioActualizacion  INT           NULL,
    CONSTRAINT PK_ParametroSistema PRIMARY KEY (IDParametroSistema),
    CONSTRAINT FK_ParametroSistema_Usuario FOREIGN KEY (IDUsuarioActualizacion) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT UQ_ParametroSistema_Clave UNIQUE (Clave),
    CONSTRAINT CK_ParametroSistema_Rango CHECK (ValorMinimo <= ValorMaximo AND Valor BETWEEN ValorMinimo AND ValorMaximo)
);
GO
