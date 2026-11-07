/* =============================================================================
   ShopCart · 053 · Datos semilla: cupones
   -----------------------------------------------------------------------------
   Un cupón para cada caso que hay que poder demostrar:
     BIENVENIDA10   10 %, compra mínima Q100, un uso por cliente
     AHORRA50       Q50 fijos, compra mínima Q300, 500 usos en total
     LUBRICANTES15  15 % solo en Lubricantes, tope de Q150
     MOTO20         20 % solo en Motos, máximo 2 usos por cliente
     VERANO2025     vencido
     AGOTADO5       límite de 5 usos (los pedidos históricos lo agotan)
     BLACKFRIDAY25  programado: todavía no está vigente
     PAUSADO10      desactivado por el administrador
     DEMO500        Q500 fijos sin mínimo: demuestra que el total nunca queda negativo
   Las fechas se guardan en UTC (medianoche de Guatemala = 06:00 UTC).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

DISABLE TRIGGER dbo.TR_Cupon_Bitacora ON dbo.Cupon;
GO

INSERT INTO dbo.Cupon (IDCategoria, Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, DescuentoMaximo,
                       FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente, Activo, FechaCreacion)
SELECT c.IDCategoria, x.Codigo, x.Descripcion, x.Tipo, x.Valor, x.Minimo, x.Tope,
       x.Inicio, x.Fin, x.LimiteTotal, x.LimiteCliente, x.Activo, DATEADD(DAY, -100, SYSUTCDATETIME())
FROM (VALUES
    ('BIENVENIDA10',  N'10 % en tu primera compra',                  'PORCENTAJE', 10.00, 100.00, NULL,   NULL,                 '2026-01-01T06:00:00', '2028-01-01T06:00:00', NULL, 1,    1),
    ('AHORRA50',      N'Q50 de descuento en compras desde Q300',     'MONTO',      50.00, 300.00, NULL,   NULL,                 '2026-01-01T06:00:00', '2027-07-01T06:00:00', 500,  NULL, 1),
    ('LUBRICANTES15', N'15 % en lubricantes (máximo Q150)',          'PORCENTAJE', 15.00,   0.00, 150.00, N'Lubricantes',       '2026-06-01T06:00:00', '2027-04-01T06:00:00', NULL, NULL, 1),
    ('MOTO20',        N'20 % en equipo para moto',                   'PORCENTAJE', 20.00,   0.00, NULL,   N'Motos',             '2026-09-01T06:00:00', '2027-02-01T06:00:00', NULL, 2,    1),
    ('VERANO2025',    N'Promoción de verano 2025',                   'PORCENTAJE', 15.00,   0.00, NULL,   NULL,                 '2025-03-01T06:00:00', '2025-05-01T06:00:00', NULL, NULL, 1),
    ('AGOTADO5',      N'5 % para los primeros 5 pedidos',            'PORCENTAJE',  5.00,   0.00, NULL,   NULL,                 '2026-06-01T06:00:00', '2027-01-01T06:00:00', 5,    NULL, 1),
    ('BLACKFRIDAY25', N'Black Friday: 25 % (máximo Q250)',           'PORCENTAJE', 25.00,   0.00, 250.00, NULL,                 '2026-11-27T06:00:00', '2026-12-01T06:00:00', NULL, 1,    1),
    ('PAUSADO10',     N'Promoción pausada por el administrador',     'PORCENTAJE', 10.00,   0.00, NULL,   NULL,                 '2026-01-01T06:00:00', '2027-01-01T06:00:00', NULL, NULL, 0),
    ('DEMO500',       N'Q500 sin mínimo (para probar el tope del descuento)', 'MONTO', 500.00, 0.00, NULL, NULL,               '2026-01-01T06:00:00', '2027-07-01T06:00:00', 50,   1,    1)
) AS x (Codigo, Descripcion, Tipo, Valor, Minimo, Tope, Categoria, Inicio, Fin, LimiteTotal, LimiteCliente, Activo)
LEFT JOIN dbo.Categoria c ON c.Nombre = x.Categoria;
GO

ENABLE TRIGGER dbo.TR_Cupon_Bitacora ON dbo.Cupon;
GO
