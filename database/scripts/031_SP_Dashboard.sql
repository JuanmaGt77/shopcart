/* =============================================================================
   ShopCart · 031 · SPs del dashboard y reportes
   -----------------------------------------------------------------------------
   Regla de los reportes: solo cuentan los pedidos cuyo estado tiene
   CuentaComoVenta = 1. Así se excluyen los cancelados y los devueltos por
   completo, y a los demás se les resta lo devuelto. La regla vive en las vistas
   VW_Dashboard_* para que todos los reportes la apliquen igual.
   Las fechas son días calendario de Guatemala (Pedido.FechaLocal).
   Si no se indican fechas, se toman los últimos 30 días.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Resumen
    @Desde DATE = NULL,
    @Hasta DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @Hoy DATE = CAST(DATEADD(HOUR, -6, @Ahora) AS DATE);
    SET @Hasta = ISNULL(@Hasta, @Hoy);
    SET @Desde = ISNULL(@Desde, DATEADD(DAY, -29, @Hasta));

    IF @Desde > @Hasta
        THROW 50001, N'La fecha inicial no puede ser mayor que la final.', 1;

    DECLARE @Horas INT = ISNULL((SELECT Valor FROM dbo.ParametroSistema WHERE Clave = 'HORAS_CARRITO_ABANDONADO'), 24);
    DECLARE @Umbral INT = ISNULL((SELECT Valor FROM dbo.ParametroSistema WHERE Clave = 'UMBRAL_STOCK_BAJO'), 5);

    SELECT
        Desde               = @Desde,
        Hasta               = @Hasta,
        VentasNetas         = CAST(ISNULL(SUM(v.VentaNeta), 0) AS DECIMAL(14,2)),
        Pedidos             = COUNT(v.IDPedido),
        TicketPromedio      = CAST(CASE WHEN COUNT(v.IDPedido) > 0 THEN ROUND(SUM(v.VentaNeta) / COUNT(v.IDPedido), 2) ELSE 0 END AS DECIMAL(12,2)),
        MontoDevuelto       = CAST(ISNULL(SUM(v.MontoDevuelto), 0) AS DECIMAL(14,2)),
        UnidadesVendidas    = (SELECT ISNULL(SUM(l.UnidadesNetas), 0) FROM dbo.VW_Dashboard_LineasVendidas l
                               WHERE l.FechaLocal BETWEEN @Desde AND @Hasta),
        PedidosCancelados   = (SELECT COUNT(*) FROM dbo.Pedido p
                               INNER JOIN dbo.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
                               WHERE e.Codigo = 'CANCELADO' AND p.FechaLocal BETWEEN @Desde AND @Hasta),
        CarritosAbandonados = (SELECT COUNT(*) FROM dbo.Carrito c
                               WHERE c.Estado = 'ACTIVO'
                                 AND c.FechaUltimaActividad < DATEADD(HOUR, -@Horas, @Ahora)
                                 AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle d WHERE d.IDCarrito = c.IDCarrito)),
        VariantesBajoStock  = (SELECT COUNT(*) FROM dbo.Variante x WHERE x.Activo = 1 AND x.Disponible <= @Umbral),
        ClientesNuevos      = (SELECT COUNT(*) FROM dbo.Usuario u
                               INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
                               WHERE r.Codigo = 'CLIENTE'
                                 AND CAST(DATEADD(HOUR, -6, u.FechaCreacion) AS DATE) BETWEEN @Desde AND @Hasta)
    FROM dbo.VW_Dashboard_VentasPorPedido v
    WHERE v.FechaLocal BETWEEN @Desde AND @Hasta;

    -- Cuántos pedidos hay en cada estado (de los creados en el rango)
    SELECT e.Codigo, e.Nombre, Pedidos = COUNT(p.IDPedido)
    FROM dbo.EstadoPedido e
    LEFT JOIN dbo.Pedido p ON p.IDEstadoPedido = e.IDEstadoPedido AND p.FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY e.Codigo, e.Nombre, e.Orden
    ORDER BY e.Orden;
END;
GO

-- Ventas por día, semana (lunes a domingo) o mes, en quetzales y en número de pedidos.
-- Devuelve también los periodos sin ventas (en cero) para que las gráficas no tengan huecos.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorPeriodo
    @Agrupacion VARCHAR(6) = 'DIA',   -- DIA | SEMANA | MES
    @Desde      DATE       = NULL,
    @Hasta      DATE       = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Hoy DATE = CAST(DATEADD(HOUR, -6, SYSUTCDATETIME()) AS DATE);
    SET @Hasta = ISNULL(@Hasta, @Hoy);
    SET @Desde = ISNULL(@Desde, DATEADD(DAY, -29, @Hasta));

    IF @Agrupacion NOT IN ('DIA', 'SEMANA', 'MES')
        THROW 50001, N'La agrupación debe ser DIA, SEMANA o MES.', 1;
    IF @Desde > @Hasta
        THROW 50001, N'La fecha inicial no puede ser mayor que la final.', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 999
        THROW 50001, N'El rango máximo es de 1000 días.', 1;

    WITH Digitos AS (
        SELECT d FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS x (d)
    ),
    Numeros AS (
        SELECT n = a.d + b.d * 10 + c.d * 100
        FROM Digitos a CROSS JOIN Digitos b CROSS JOIN Digitos c
    ),
    Periodos AS (
        SELECT DISTINCT ip.InicioPeriodo
        FROM Numeros
        CROSS APPLY dbo.FU_Dashboard_InicioPeriodo(DATEADD(DAY, n, @Desde), @Agrupacion) ip
        WHERE n <= DATEDIFF(DAY, @Desde, @Hasta)
    ),
    Ventas AS (
        SELECT ip.InicioPeriodo, Pedidos = COUNT(*), Monto = SUM(v.VentaNeta)
        FROM dbo.VW_Dashboard_VentasPorPedido v
        CROSS APPLY dbo.FU_Dashboard_InicioPeriodo(v.FechaLocal, @Agrupacion) ip
        WHERE v.FechaLocal BETWEEN @Desde AND @Hasta
        GROUP BY ip.InicioPeriodo
    )
    SELECT Periodo        = p.InicioPeriodo,
           Pedidos        = ISNULL(v.Pedidos, 0),
           MontoVendido   = CAST(ISNULL(v.Monto, 0) AS DECIMAL(14,2)),
           TicketPromedio = CAST(CASE WHEN v.Pedidos > 0 THEN ROUND(v.Monto / v.Pedidos, 2) ELSE 0 END AS DECIMAL(12,2))
    FROM Periodos p
    LEFT JOIN Ventas v ON v.InicioPeriodo = p.InicioPeriodo
    ORDER BY p.InicioPeriodo;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorCategoria
    @Desde DATE = NULL,
    @Hasta DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Hoy DATE = CAST(DATEADD(HOUR, -6, SYSUTCDATETIME()) AS DATE);
    SET @Hasta = ISNULL(@Hasta, @Hoy);
    SET @Desde = ISNULL(@Desde, DATEADD(DAY, -29, @Hasta));

    IF @Desde > @Hasta
        THROW 50001, N'La fecha inicial no puede ser mayor que la final.', 1;

    WITH Totales AS (
        SELECT IDCategoria, Categoria, Unidades = SUM(Unidades), Monto = SUM(Monto), Pedidos = SUM(Pedidos)
        FROM dbo.VW_Dashboard_VentasPorCategoria
        WHERE FechaLocal BETWEEN @Desde AND @Hasta
        GROUP BY IDCategoria, Categoria
    )
    SELECT IDCategoria, Categoria, Unidades, Monto = CAST(Monto AS DECIMAL(14,2)), Pedidos,
           Porcentaje = CAST(CASE WHEN SUM(Monto) OVER () > 0 THEN ROUND(100.0 * Monto / SUM(Monto) OVER (), 2) ELSE 0 END AS DECIMAL(5,2))
    FROM Totales
    ORDER BY Monto DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_TopProductos
    @Desde  DATE = NULL,
    @Hasta  DATE = NULL,
    @Limite INT  = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Hoy DATE = CAST(DATEADD(HOUR, -6, SYSUTCDATETIME()) AS DATE);
    SET @Hasta = ISNULL(@Hasta, @Hoy);
    SET @Desde = ISNULL(@Desde, DATEADD(DAY, -29, @Hasta));

    IF @Desde > @Hasta
        THROW 50001, N'La fecha inicial no puede ser mayor que la final.', 1;
    IF @Limite NOT BETWEEN 1 AND 50
        THROW 50001, N'El límite debe estar entre 1 y 50.', 1;

    SELECT TOP (@Limite)
           Posicion = ROW_NUMBER() OVER (ORDER BY SUM(l.UnidadesNetas) DESC, SUM(l.MontoNeto) DESC, l.IDProducto),
           l.IDProducto,
           Producto  = p.Nombre,
           Categoria = c.Nombre,
           Unidades  = SUM(l.UnidadesNetas),
           Monto     = CAST(SUM(l.MontoNeto) AS DECIMAL(14,2)),
           Pedidos   = COUNT(DISTINCT l.IDPedido)
    FROM dbo.VW_Dashboard_LineasVendidas l
    INNER JOIN dbo.Producto p  ON p.IDProducto = l.IDProducto
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE l.FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY l.IDProducto, p.Nombre, c.Nombre
    HAVING SUM(l.UnidadesNetas) > 0
    ORDER BY Unidades DESC, Monto DESC, l.IDProducto;
END;
GO

-- Carritos con productos y sin actividad en las últimas N horas (parámetro configurable)
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_CarritosAbandonados
    @Horas          INT = NULL,
    @Pagina         INT = 1,
    @TamanoPagina   INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    SET @Horas = ISNULL(@Horas, ISNULL((SELECT Valor FROM dbo.ParametroSistema WHERE Clave = 'HORAS_CARRITO_ABANDONADO'), 24));
    IF @Horas < 1
        THROW 50001, N'Las horas de inactividad deben ser al menos 1.', 1;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    WITH Abandonados AS (
        SELECT c.IDCarrito, c.IDUsuario,
               Cliente = CASE WHEN u.IDUsuario IS NULL THEN N'Invitado' ELSE CONCAT(u.Nombres, N' ', u.Apellidos) END,
               Correo = u.Correo,
               r.CantidadArticulos, r.CantidadLineas,
               ValorEstimado = r.Subtotal,
               c.FechaUltimaActividad,
               HorasInactivo = DATEDIFF(HOUR, c.FechaUltimaActividad, @Ahora)
        FROM dbo.Carrito c
        LEFT JOIN dbo.Usuario u ON u.IDUsuario = c.IDUsuario
        CROSS APPLY dbo.FU_Carrito_Resumen(c.IDCarrito, @Ahora) r
        WHERE c.Estado = 'ACTIVO'
          AND c.FechaUltimaActividad < DATEADD(HOUR, -@Horas, @Ahora)
          AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle d WHERE d.IDCarrito = c.IDCarrito)
    )
    SELECT IDCarrito, IDUsuario, Cliente, Correo, CantidadArticulos, CantidadLineas, ValorEstimado,
           FechaUltimaActividad, HorasInactivo,
           HorasConfiguradas = @Horas,
           ValorTotalAbandonado = SUM(ValorEstimado) OVER (),
           TotalRegistros = COUNT(*) OVER ()
    FROM Abandonados
    ORDER BY FechaUltimaActividad DESC, IDCarrito DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
