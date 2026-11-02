/* =============================================================================
   ShopCart · 013 · Triggers
   -----------------------------------------------------------------------------
   1. Inmutabilidad: Bitacora, Kardex y PedidoHistorialEstado no aceptan UPDATE
      ni DELETE, ni siquiera desde SSMS con un usuario administrador.
   2. Pedidos: TR_Pedido_Estado valida cada cambio de estado contra la tabla
      EstadoPedidoTransicion. Si la transición no está permitida, revierte todo.
      También deja el historial (usuario, fecha, estado anterior y nuevo).
   3. Bitácora automática para productos, variantes (precio, existencia,
      activación), categorías, cupones, usuarios y parámetros.

   ¿Cómo sabe el trigger qué usuario de la aplicación hizo el cambio?
   Cada SP que modifica datos guarda el IDUsuario en SESSION_CONTEXT al iniciar
   (SP_Sistema_EstablecerUsuario) y los triggers lo leen. Si alguien modifica
   directo en la base, IDUsuario queda NULL pero UsuarioBD guarda su login.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

/* --- 1. Inmutabilidad ------------------------------------------------------ */

CREATE OR ALTER TRIGGER dbo.TR_Bitacora_Inmutable
ON dbo.Bitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 60001, N'La bitácora es de solo lectura: sus registros no se pueden modificar ni eliminar.', 1;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Kardex_Inmutable
ON dbo.Kardex
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 60002, N'El kardex no se puede modificar ni eliminar. Para corregir existencias registra un ajuste.', 1;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_PedidoHistorialEstado_Inmutable
ON dbo.PedidoHistorialEstado
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 60003, N'El historial de estados de un pedido no se puede modificar ni eliminar.', 1;
END;
GO

/* --- 2. Ciclo de vida del pedido ------------------------------------------- */

CREATE OR ALTER TRIGGER dbo.TR_Pedido_Estado
ON dbo.Pedido
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    -- Pedido nuevo: solo puede nacer en el estado inicial
    IF NOT EXISTS (SELECT 1 FROM deleted)
    BEGIN
        IF EXISTS (SELECT 1
                   FROM inserted i
                   INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = i.IDEstadoPedido
                   WHERE e.EsInicial = 0)
            THROW 58002, N'Un pedido solo puede crearse en el estado inicial.', 1;

        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
        SELECT i.IDPedido, NULL, i.IDEstadoPedido, @IDUsuario, i.ComentarioEstado
        FROM inserted i;

        INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
        SELECT 'PEDIDOS', 'Pedido', CAST(i.IDPedido AS VARCHAR(40)), 'CREAR', NULL,
               (SELECT i.NumeroPedido AS numero, e.Codigo AS estado, i.Total AS total, i.CodigoCupon AS cupon
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @IDUsuario
        FROM inserted i
        INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = i.IDEstadoPedido;
        RETURN;
    END;

    IF UPDATE(IDEstadoPedido)
    BEGIN
        -- Cualquier cambio que no esté en la tabla de transiciones se rechaza
        IF EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN deleted d ON d.IDPedido = i.IDPedido
            WHERE i.IDEstadoPedido <> d.IDEstadoPedido
              AND NOT EXISTS (SELECT 1
                              FROM dbo.EstadoPedidoTransicion t
                              WHERE t.IDEstadoOrigen = d.IDEstadoPedido
                                AND t.IDEstadoDestino = i.IDEstadoPedido)
        )
            THROW 58002, N'Transición de estado no permitida para el pedido.', 1;

        INSERT INTO dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
        SELECT i.IDPedido, d.IDEstadoPedido, i.IDEstadoPedido, @IDUsuario, i.ComentarioEstado
        FROM inserted i
        INNER JOIN deleted d ON d.IDPedido = i.IDPedido
        WHERE i.IDEstadoPedido <> d.IDEstadoPedido;

        INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
        SELECT 'PEDIDOS', 'Pedido', CAST(i.IDPedido AS VARCHAR(40)), 'CAMBIO_ESTADO',
               (SELECT ea.Codigo AS estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               (SELECT en.Codigo AS estado, i.ComentarioEstado AS comentario FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
               @IDUsuario
        FROM inserted i
        INNER JOIN deleted d           ON d.IDPedido = i.IDPedido
        INNER JOIN dbo.EstadoPedido ea ON ea.IDEstadoPedido = d.IDEstadoPedido
        INNER JOIN dbo.EstadoPedido en ON en.IDEstadoPedido = i.IDEstadoPedido
        WHERE i.IDEstadoPedido <> d.IDEstadoPedido;
    END;
END;
GO

/* --- 3. Bitácora automática ------------------------------------------------- */

CREATE OR ALTER TRIGGER dbo.TR_Producto_Bitacora
ON dbo.Producto
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'CATALOGO', 'Producto', CAST(COALESCE(i.IDProducto, d.IDProducto) AS VARCHAR(40)),
           CASE WHEN d.IDProducto IS NULL THEN 'CREAR'
                WHEN i.IDProducto IS NULL THEN 'ELIMINAR'
                WHEN i.Activo = 0 AND d.Activo = 1 THEN 'DESACTIVAR'
                WHEN i.Activo = 1 AND d.Activo = 0 THEN 'ACTIVAR'
                ELSE 'MODIFICAR' END,
           CASE WHEN d.IDProducto IS NOT NULL THEN
               (SELECT d.IDCategoria AS idCategoria, d.Nombre AS nombre, d.Descripcion AS descripcion,
                       d.Marca AS marca, d.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           CASE WHEN i.IDProducto IS NOT NULL THEN
               (SELECT i.IDCategoria AS idCategoria, i.Nombre AS nombre, i.Descripcion AS descripcion,
                       i.Marca AS marca, i.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           @IDUsuario
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.IDProducto = i.IDProducto
    WHERE d.IDProducto IS NULL
       OR i.IDProducto IS NULL
       OR EXISTS (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Marca, i.Activo
                  EXCEPT
                  SELECT d.IDCategoria, d.Nombre, d.Descripcion, d.Marca, d.Activo);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Variante_Bitacora
ON dbo.Variante
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    -- Los cambios en Reservada (reservas de checkout) no se registran: son temporales
    -- y su rastro queda en Checkout. Lo que sí se registra es precio, existencia física,
    -- activación y SKU.
    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'CATALOGO', 'Variante', CAST(i.IDVariante AS VARCHAR(40)), 'CREAR', NULL,
           (SELECT i.IDProducto AS idProducto, i.SKU AS sku, i.Precio AS precio, i.Existencia AS existencia, i.Activo AS activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           @IDUsuario
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM deleted d WHERE d.IDVariante = i.IDVariante)

    UNION ALL
    SELECT 'CATALOGO', 'Variante', CAST(i.IDVariante AS VARCHAR(40)), 'CAMBIO_PRECIO',
           (SELECT d.SKU AS sku, d.Precio AS precio FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.SKU AS sku, i.Precio AS precio FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDVariante = i.IDVariante
    WHERE i.Precio <> d.Precio

    UNION ALL
    SELECT 'INVENTARIO', 'Variante', CAST(i.IDVariante AS VARCHAR(40)), 'CAMBIO_EXISTENCIA',
           (SELECT d.SKU AS sku, d.Existencia AS existencia FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.SKU AS sku, i.Existencia AS existencia FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDVariante = i.IDVariante
    WHERE i.Existencia <> d.Existencia

    UNION ALL
    SELECT 'CATALOGO', 'Variante', CAST(i.IDVariante AS VARCHAR(40)),
           CASE WHEN i.Activo = 1 THEN 'ACTIVAR' ELSE 'DESACTIVAR' END,
           (SELECT d.SKU AS sku, d.Activo AS activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.SKU AS sku, i.Activo AS activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDVariante = i.IDVariante
    WHERE i.Activo <> d.Activo

    UNION ALL
    SELECT 'CATALOGO', 'Variante', CAST(i.IDVariante AS VARCHAR(40)), 'MODIFICAR',
           (SELECT d.SKU AS sku FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.SKU AS sku FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDVariante = i.IDVariante
    WHERE i.SKU COLLATE Latin1_General_BIN2 <> d.SKU COLLATE Latin1_General_BIN2

    UNION ALL
    SELECT 'CATALOGO', 'Variante', CAST(d.IDVariante AS VARCHAR(40)), 'ELIMINAR',
           (SELECT d.IDProducto AS idProducto, d.SKU AS sku, d.Precio AS precio, d.Existencia AS existencia
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           NULL,
           @IDUsuario
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted i WHERE i.IDVariante = d.IDVariante);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Categoria_Bitacora
ON dbo.Categoria
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'CATALOGO', 'Categoria', CAST(COALESCE(i.IDCategoria, d.IDCategoria) AS VARCHAR(40)),
           CASE WHEN d.IDCategoria IS NULL THEN 'CREAR'
                WHEN i.IDCategoria IS NULL THEN 'ELIMINAR'
                WHEN i.Activo = 0 AND d.Activo = 1 THEN 'DESACTIVAR'
                WHEN i.Activo = 1 AND d.Activo = 0 THEN 'ACTIVAR'
                ELSE 'MODIFICAR' END,
           CASE WHEN d.IDCategoria IS NOT NULL THEN
               (SELECT d.Nombre AS nombre, d.Descripcion AS descripcion, d.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           CASE WHEN i.IDCategoria IS NOT NULL THEN
               (SELECT i.Nombre AS nombre, i.Descripcion AS descripcion, i.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           @IDUsuario
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.IDCategoria = i.IDCategoria
    WHERE d.IDCategoria IS NULL
       OR i.IDCategoria IS NULL
       OR EXISTS (SELECT i.Nombre, i.Descripcion, i.Activo EXCEPT SELECT d.Nombre, d.Descripcion, d.Activo);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Cupon_Bitacora
ON dbo.Cupon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    -- El contador UsosActuales cambia con cada compra; ese rastro ya está en CuponUso,
    -- así que aquí solo registro cambios hechos por un administrador.
    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'CUPONES', 'Cupon', CAST(COALESCE(i.IDCupon, d.IDCupon) AS VARCHAR(40)),
           CASE WHEN d.IDCupon IS NULL THEN 'CREAR'
                WHEN i.IDCupon IS NULL THEN 'ELIMINAR'
                WHEN i.Activo = 0 AND d.Activo = 1 THEN 'DESACTIVAR'
                WHEN i.Activo = 1 AND d.Activo = 0 THEN 'ACTIVAR'
                ELSE 'MODIFICAR' END,
           CASE WHEN d.IDCupon IS NOT NULL THEN
               (SELECT d.Codigo AS codigo, d.TipoDescuento AS tipo, d.Valor AS valor, d.MontoMinimo AS montoMinimo,
                       d.DescuentoMaximo AS descuentoMaximo, d.IDCategoria AS idCategoria, d.FechaInicio AS fechaInicio,
                       d.FechaFin AS fechaFin, d.LimiteUsosTotal AS limiteUsosTotal,
                       d.LimiteUsosPorCliente AS limiteUsosPorCliente, d.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           CASE WHEN i.IDCupon IS NOT NULL THEN
               (SELECT i.Codigo AS codigo, i.TipoDescuento AS tipo, i.Valor AS valor, i.MontoMinimo AS montoMinimo,
                       i.DescuentoMaximo AS descuentoMaximo, i.IDCategoria AS idCategoria, i.FechaInicio AS fechaInicio,
                       i.FechaFin AS fechaFin, i.LimiteUsosTotal AS limiteUsosTotal,
                       i.LimiteUsosPorCliente AS limiteUsosPorCliente, i.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           @IDUsuario
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.IDCupon = i.IDCupon
    WHERE d.IDCupon IS NULL
       OR i.IDCupon IS NULL
       OR EXISTS (SELECT i.Codigo, i.TipoDescuento, i.Valor, i.MontoMinimo, i.DescuentoMaximo, i.IDCategoria,
                         i.FechaInicio, i.FechaFin, i.LimiteUsosTotal, i.LimiteUsosPorCliente, i.Activo
                  EXCEPT
                  SELECT d.Codigo, d.TipoDescuento, d.Valor, d.MontoMinimo, d.DescuentoMaximo, d.IDCategoria,
                         d.FechaInicio, d.FechaFin, d.LimiteUsosTotal, d.LimiteUsosPorCliente, d.Activo);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Usuario_Bitacora
ON dbo.Usuario
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    -- Nunca se registra el hash de la contraseña. Tampoco los inicios de sesión.
    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'USUARIOS', 'Usuario', CAST(i.IDUsuario AS VARCHAR(40)),
           CASE WHEN d.IDUsuario IS NULL THEN 'CREAR'
                WHEN i.Activo = 0 AND d.Activo = 1 THEN 'DESACTIVAR'
                WHEN i.Activo = 1 AND d.Activo = 0 THEN 'ACTIVAR'
                ELSE 'MODIFICAR' END,
           CASE WHEN d.IDUsuario IS NOT NULL THEN
               (SELECT d.Correo AS correo, r1.Codigo AS rol, d.Nombres AS nombres, d.Apellidos AS apellidos,
                       d.Telefono AS telefono, d.Activo AS activo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) END,
           (SELECT i.Correo AS correo, r2.Codigo AS rol, i.Nombres AS nombres, i.Apellidos AS apellidos,
                   i.Telefono AS telefono, i.Activo AS activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           COALESCE(@IDUsuario, CASE WHEN d.IDUsuario IS NULL THEN i.IDUsuario END)
    FROM inserted i
    LEFT JOIN deleted d  ON d.IDUsuario = i.IDUsuario
    INNER JOIN dbo.Rol r2 ON r2.IDRol = i.IDRol
    LEFT JOIN dbo.Rol r1  ON r1.IDRol = d.IDRol
    WHERE d.IDUsuario IS NULL
       OR EXISTS (SELECT i.Correo, i.IDRol, i.Nombres, i.Apellidos, i.Telefono, i.Activo
                  EXCEPT
                  SELECT d.Correo, d.IDRol, d.Nombres, d.Apellidos, d.Telefono, d.Activo);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_ParametroSistema_Bitacora
ON dbo.ParametroSistema
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT 'SISTEMA', 'ParametroSistema', i.Clave, 'MODIFICAR',
           (SELECT d.Valor AS valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.Valor AS valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           COALESCE(@IDUsuario, i.IDUsuarioActualizacion)
    FROM inserted i
    INNER JOIN deleted d ON d.IDParametroSistema = i.IDParametroSistema
    WHERE i.Valor <> d.Valor;
END;
GO
