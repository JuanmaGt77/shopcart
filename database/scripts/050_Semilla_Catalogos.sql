/* =============================================================================
   ShopCart · 050 · Datos semilla: catálogos base
   -----------------------------------------------------------------------------
   Roles, estados del pedido con sus transiciones, tipos de movimiento de
   inventario, departamentos de Guatemala, métodos de envío y parámetros.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

INSERT INTO dbo.Rol (Codigo, Nombre, Descripcion) VALUES
    ('CLIENTE',  N'Cliente',       N'Compra en la tienda y consulta solo su propia información.'),
    ('OPERADOR', N'Operador',      N'Prepara y despacha pedidos, registra devoluciones y movimientos de inventario.'),
    ('ADMIN',    N'Administrador', N'Además de lo del operador, administra catálogo, precios, cupones, usuarios y reportes.');
GO

-- Ciclo de vida del pedido
INSERT INTO dbo.EstadoPedido (Codigo, Nombre, Descripcion, EsInicial, EsFinal, CuentaComoVenta, Orden) VALUES
    ('PAGADO',           N'Pagado',             N'El pago se confirmó y el pedido está esperando preparación.', 1, 0, 1, 1),
    ('EN_PREPARACION',   N'En preparación',     N'Bodega está armando el pedido.',                               0, 0, 1, 2),
    ('DESPACHADO',       N'Despachado',         N'El pedido salió con el transportista.',                        0, 0, 1, 3),
    ('ENTREGADO',        N'Entregado',          N'El cliente recibió el pedido.',                                0, 0, 1, 4),
    ('DEVUELTO_PARCIAL', N'Devuelto parcialmente', N'Se devolvió parte de los productos.',                       0, 0, 1, 5),
    ('DEVUELTO',         N'Devuelto',           N'Se devolvieron todos los productos y se reembolsó el total.',  0, 1, 0, 6),
    ('CANCELADO',        N'Cancelado',          N'Se canceló antes del despacho; se reembolsó y el inventario se reintegró.', 0, 1, 0, 7);
GO

INSERT INTO dbo.EstadoPedidoTransicion (IDEstadoOrigen, IDEstadoDestino)
SELECT o.IDEstadoPedido, d.IDEstadoPedido
FROM (VALUES
        ('PAGADO',           'EN_PREPARACION'),
        ('PAGADO',           'CANCELADO'),
        ('EN_PREPARACION',   'DESPACHADO'),
        ('EN_PREPARACION',   'CANCELADO'),
        ('DESPACHADO',       'ENTREGADO'),
        ('ENTREGADO',        'DEVUELTO_PARCIAL'),
        ('ENTREGADO',        'DEVUELTO'),
        ('DEVUELTO_PARCIAL', 'DEVUELTO')
     ) AS t (Origen, Destino)
INNER JOIN dbo.EstadoPedido o ON o.Codigo = t.Origen
INNER JOIN dbo.EstadoPedido d ON d.Codigo = t.Destino;
GO

INSERT INTO dbo.TipoMovimiento (Codigo, Nombre, Naturaleza, EsManual, RequiereMotivo) VALUES
    ('ENTRADA_COMPRA', N'Entrada por compra',    'E', 1, 1),
    ('AJUSTE_ENTRADA', N'Ajuste positivo',       'E', 1, 1),
    ('AJUSTE_SALIDA',  N'Ajuste negativo',       'S', 1, 1),
    ('SALIDA_VENTA',   N'Salida por venta',      'S', 0, 0),
    ('CANCELACION',    N'Reingreso por cancelación', 'E', 0, 0),
    ('DEVOLUCION',     N'Reingreso por devolución',  'E', 0, 0);
GO

INSERT INTO dbo.Departamento (Nombre) VALUES
    (N'Alta Verapaz'), (N'Baja Verapaz'), (N'Chimaltenango'), (N'Chiquimula'), (N'El Progreso'),
    (N'Escuintla'), (N'Guatemala'), (N'Huehuetenango'), (N'Izabal'), (N'Jalapa'), (N'Jutiapa'),
    (N'Petén'), (N'Quetzaltenango'), (N'Quiché'), (N'Retalhuleu'), (N'Sacatepéquez'), (N'San Marcos'),
    (N'Santa Rosa'), (N'Sololá'), (N'Suchitepéquez'), (N'Totonicapán'), (N'Zacapa');
GO

INSERT INTO dbo.MetodoEnvio (Codigo, Nombre, Descripcion, Costo, DiasEstimadosMin, DiasEstimadosMax) VALUES
    ('ESTANDAR', N'Envío estándar',    N'Entrega a domicilio en todo el país.',          35.00, 2, 4),
    ('EXPRESS',  N'Envío express',     N'Entrega al día siguiente en la ciudad capital.', 60.00, 1, 1),
    ('TIENDA',   N'Recoger en tienda', N'Recógelo sin costo en cualquiera de nuestras tiendas.', 0.00, 1, 2);
GO

INSERT INTO dbo.ParametroSistema (Clave, Valor, ValorMinimo, ValorMaximo, Descripcion) VALUES
    ('SEGUNDOS_RESERVA_CHECKOUT', 900, 1, 3600, N'Tiempo que se aparta la existencia al iniciar el pago (900 segundos = 15 minutos).'),
    ('HORAS_CARRITO_ABANDONADO',  24,  1, 720,  N'Horas sin actividad para considerar un carrito como abandonado.'),
    ('UMBRAL_STOCK_BAJO',          5,  0, 1000, N'Unidades disponibles a partir de las cuales una variante se marca con existencia baja.');
GO
