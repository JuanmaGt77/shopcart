/* =============================================================================
   ShopCart · 011 · Funciones
   -----------------------------------------------------------------------------
   Todas son funciones tipo tabla en línea (inline TVF): el optimizador las
   expande dentro de la consulta que las usa, así que no tienen el costo de las
   funciones escalares fila por fila.

   La lógica de cupones vive en un solo lugar (FU_Cupones_EvaluarCarrito). El
   carrito, el checkout y el SP que aplica el cupón usan exactamente las mismas
   reglas y los mismos mensajes.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

-- Arma el patrón para un LIKE de búsqueda escapando los comodines (% _ [) que
-- escriba el usuario, para que se busquen como texto literal.
CREATE OR ALTER FUNCTION dbo.FU_Sistema_PatronBusqueda (@Texto NVARCHAR(100))
RETURNS TABLE
AS
RETURN
    SELECT Patron = CAST(CASE
        WHEN NULLIF(LTRIM(RTRIM(@Texto)), N'') IS NULL THEN NULL
        ELSE N'%' + REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(@Texto)), N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]') + N'%'
    END AS NVARCHAR(320));
GO

-- "Color: Negro / Talla: M" a partir de los atributos de la variante
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_DescripcionVariante (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT Descripcion = CAST(LEFT(
               STRING_AGG(CAST(CONCAT(a.Nombre, N': ', av.Valor) AS NVARCHAR(120)), N' / ')
                   WITHIN GROUP (ORDER BY a.Nombre), 200) AS NVARCHAR(200))
    FROM dbo.VarianteAtributo va
    INNER JOIN dbo.Atributo a       ON a.IDAtributo = va.IDAtributo
    INNER JOIN dbo.AtributoValor av ON av.IDAtributoValor = va.IDAtributoValor
    WHERE va.IDVariante = @IDVariante;
GO

-- "Color=Negro|Talla=M": sirve para impedir dos variantes iguales en un producto
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_FirmaVariante (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT Firma = STRING_AGG(CAST(CONCAT(a.Nombre, N'=', av.Valor) AS NVARCHAR(120)), N'|')
                       WITHIN GROUP (ORDER BY a.Nombre)
    FROM dbo.VarianteAtributo va
    INNER JOIN dbo.Atributo a       ON a.IDAtributo = va.IDAtributo
    INNER JOIN dbo.AtributoValor av ON av.IDAtributoValor = va.IDAtributoValor
    WHERE va.IDVariante = @IDVariante;
GO

-- Líneas del carrito con el precio vigente y si se pueden vender
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Lineas (@IDCarrito INT)
RETURNS TABLE
AS
RETURN
    SELECT
        cd.IDCarritoDetalle,
        cd.IDVariante,
        v.SKU,
        p.IDProducto,
        NombreProducto      = p.Nombre,
        DescripcionVariante = d.Descripcion,
        p.IDCategoria,
        Categoria           = c.Nombre,
        cd.Cantidad,
        PrecioUnitario      = v.Precio,
        Subtotal            = CAST(cd.Cantidad * v.Precio AS DECIMAL(12,2)),
        v.Disponible,
        Vendible            = CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1 THEN 1 ELSE 0 END AS BIT),
        ExcedeDisponible    = CAST(CASE WHEN cd.Cantidad > v.Disponible THEN 1 ELSE 0 END AS BIT),
        ImagenUrl           = (SELECT TOP (1) i.Url FROM dbo.ProductoImagen i
                               WHERE i.IDProducto = p.IDProducto ORDER BY i.Orden),
        cd.FechaAgregado
    FROM dbo.CarritoDetalle cd
    INNER JOIN dbo.Variante v  ON v.IDVariante = cd.IDVariante
    INNER JOIN dbo.Producto p  ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    OUTER APPLY dbo.FU_Catalogo_DescripcionVariante(v.IDVariante) d
    WHERE cd.IDCarrito = @IDCarrito;
GO

-- Monto de descuento de un cupón sobre el subtotal al que aplica.
-- Nunca devuelve más que el subtotal elegible: el total no puede quedar negativo.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento
(
    @TipoDescuento      VARCHAR(10),
    @Valor              DECIMAL(12,2),
    @DescuentoMaximo    DECIMAL(12,2),
    @SubtotalElegible   DECIMAL(12,2)
)
RETURNS TABLE
AS
RETURN
    SELECT Descuento = CAST(
        CASE
            WHEN @SubtotalElegible IS NULL OR @SubtotalElegible <= 0 THEN 0
            ELSE (SELECT MIN(x.Monto)
                  FROM (VALUES
                        (CASE WHEN @TipoDescuento = 'PORCENTAJE'
                              THEN ROUND(@SubtotalElegible * @Valor / 100, 2)
                              ELSE @Valor END),
                        (@SubtotalElegible),
                        (ISNULL(@DescuentoMaximo, @SubtotalElegible))
                  ) AS x (Monto))
        END AS DECIMAL(12,2));
GO

-- Valida un cupón contra un carrito y calcula el descuento.
-- Devuelve un código de resultado y un mensaje específico para cada caso.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_EvaluarCarrito
(
    @IDCupon    INT,
    @IDCarrito  INT,
    @IDUsuario  INT,
    @Fecha      DATETIME2(3)
)
RETURNS TABLE
AS
RETURN
    WITH Lineas AS (
        SELECT l.IDCategoria, l.Subtotal
        FROM dbo.FU_Carrito_Lineas(@IDCarrito) l
        WHERE l.Vendible = 1
    ),
    Base AS (
        SELECT
            c.IDCupon, c.Codigo, c.TipoDescuento, c.Valor, c.DescuentoMaximo, c.MontoMinimo,
            c.IDCategoria, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosPorCliente,
            c.UsosActuales, c.Activo,
            NombreCategoria  = cat.Nombre,
            SubtotalCarrito  = CAST(ISNULL((SELECT SUM(l.Subtotal) FROM Lineas l), 0) AS DECIMAL(12,2)),
            SubtotalElegible = CAST(ISNULL((SELECT SUM(l.Subtotal) FROM Lineas l
                                            WHERE c.IDCategoria IS NULL OR l.IDCategoria = c.IDCategoria), 0) AS DECIMAL(12,2)),
            UsosCliente      = (SELECT COUNT(*) FROM dbo.CuponUso u
                                WHERE u.IDCupon = c.IDCupon AND u.IDUsuario = @IDUsuario AND u.Estado = 'APLICADO')
        FROM dbo.Cupon c
        LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
        WHERE c.IDCupon = @IDCupon
    )
    SELECT
        b.IDCupon,
        b.Codigo,
        r.Resultado,
        Mensaje = CAST(CASE r.Resultado
            WHEN 'CUPON_INACTIVO' THEN CONCAT(N'El cupón ', b.Codigo, N' no está disponible.')
            WHEN 'CUPON_NO_VIGENTE' THEN CONCAT(N'El cupón ', b.Codigo, N' todavía no está vigente: aplica a partir del ',
                                                CONVERT(VARCHAR(10), DATEADD(HOUR, -6, b.FechaInicio), 103), N'.')
            WHEN 'CUPON_VENCIDO' THEN CONCAT(N'El cupón ', b.Codigo, N' venció el ',
                                             CONVERT(VARCHAR(10), DATEADD(HOUR, -6, b.FechaFin), 103), N'.')
            WHEN 'CUPON_AGOTADO' THEN CONCAT(N'El cupón ', b.Codigo, N' ya se agotó: alcanzó su límite de ',
                                             b.LimiteUsosTotal, N' usos.')
            WHEN 'CUPON_LIMITE_CLIENTE' THEN CONCAT(N'Ya usaste el cupón ', b.Codigo, N' la cantidad máxima de veces permitida (',
                                                    b.LimiteUsosPorCliente, N').')
            WHEN 'CUPON_MONTO_MINIMO' THEN CONCAT(N'El cupón ', b.Codigo, N' requiere una compra mínima de Q',
                                                  CONVERT(VARCHAR(20), CAST(b.MontoMinimo AS MONEY), 1), N'. Te faltan Q',
                                                  CONVERT(VARCHAR(20), CAST(b.MontoMinimo - b.SubtotalCarrito AS MONEY), 1), N'.')
            WHEN 'CUPON_SIN_PRODUCTOS' THEN CONCAT(N'El cupón ', b.Codigo, N' solo aplica a productos de la categoría ',
                                                   b.NombreCategoria, N' y tu carrito no tiene ninguno.')
            ELSE CONCAT(N'Cupón ', b.Codigo, N' aplicado: ahorras Q', CONVERT(VARCHAR(20), CAST(d.Descuento AS MONEY), 1), N'.')
        END AS NVARCHAR(300)),
        b.SubtotalCarrito,
        b.SubtotalElegible,
        Descuento = CAST(CASE WHEN r.Resultado = 'OK' THEN d.Descuento ELSE 0 END AS DECIMAL(12,2))
    FROM Base b
    CROSS APPLY (
        SELECT Resultado = CASE
            WHEN b.Activo = 0 THEN 'CUPON_INACTIVO'
            WHEN @Fecha < b.FechaInicio THEN 'CUPON_NO_VIGENTE'
            WHEN @Fecha >= b.FechaFin THEN 'CUPON_VENCIDO'
            WHEN b.LimiteUsosTotal IS NOT NULL AND b.UsosActuales >= b.LimiteUsosTotal THEN 'CUPON_AGOTADO'
            WHEN b.LimiteUsosPorCliente IS NOT NULL AND b.UsosCliente >= b.LimiteUsosPorCliente THEN 'CUPON_LIMITE_CLIENTE'
            WHEN b.SubtotalCarrito < b.MontoMinimo THEN 'CUPON_MONTO_MINIMO'
            WHEN b.SubtotalElegible <= 0 THEN 'CUPON_SIN_PRODUCTOS'
            ELSE 'OK'
        END
    ) r
    CROSS APPLY dbo.FU_Cupones_CalculoDescuento(b.TipoDescuento, b.Valor, b.DescuentoMaximo, b.SubtotalElegible) d;
GO

-- Totales del carrito: subtotal, descuento del cupón (si sigue siendo válido) y total
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Resumen (@IDCarrito INT, @Fecha DATETIME2(3))
RETURNS TABLE
AS
RETURN
    SELECT
        c.IDCarrito,
        CantidadArticulos = ISNULL(t.Articulos, 0),
        CantidadLineas    = ISNULL(t.Lineas, 0),
        Subtotal          = CAST(ISNULL(t.Subtotal, 0) AS DECIMAL(12,2)),
        c.IDCupon,
        CodigoCupon       = cu.Codigo,
        EstadoCupon       = ev.Resultado,
        MensajeCupon      = ev.Mensaje,
        Descuento         = CAST(ISNULL(ev.Descuento, 0) AS DECIMAL(12,2)),
        Total             = CAST(ISNULL(t.Subtotal, 0) - ISNULL(ev.Descuento, 0) AS DECIMAL(12,2)),
        TieneProblemas    = CAST(CASE WHEN ISNULL(t.Problemas, 0) > 0 THEN 1 ELSE 0 END AS BIT)
    FROM dbo.Carrito c
    OUTER APPLY (
        SELECT Articulos = SUM(l.Cantidad),
               Lineas    = COUNT(*),
               Subtotal  = SUM(CASE WHEN l.Vendible = 1 THEN l.Subtotal ELSE 0 END),
               Problemas = SUM(CASE WHEN l.Vendible = 0 OR l.ExcedeDisponible = 1 THEN 1 ELSE 0 END)
        FROM dbo.FU_Carrito_Lineas(c.IDCarrito) l
    ) t
    LEFT JOIN dbo.Cupon cu ON cu.IDCupon = c.IDCupon
    OUTER APPLY dbo.FU_Cupones_EvaluarCarrito(c.IDCupon, c.IDCarrito, c.IDUsuario, @Fecha) ev
    WHERE c.IDCarrito = @IDCarrito;
GO

-- Número de error (THROW) que corresponde a cada resultado de FU_Cupones_EvaluarCarrito
CREATE OR ALTER FUNCTION dbo.FU_Cupones_NumeroError (@Resultado VARCHAR(30))
RETURNS TABLE
AS
RETURN
    SELECT NumeroError = CASE @Resultado
        WHEN 'CUPON_INACTIVO'       THEN 55002
        WHEN 'CUPON_NO_VIGENTE'     THEN 55003
        WHEN 'CUPON_VENCIDO'        THEN 55004
        WHEN 'CUPON_AGOTADO'        THEN 55005
        WHEN 'CUPON_LIMITE_CLIENTE' THEN 55006
        WHEN 'CUPON_MONTO_MINIMO'   THEN 55007
        WHEN 'CUPON_SIN_PRODUCTOS'  THEN 55008
        ELSE 55002
    END;
GO

-- Texto completo de una dirección para mostrarla y para guardar la copia en el pedido
CREATE OR ALTER FUNCTION dbo.FU_Direcciones_TextoEntrega (@IDDireccion INT)
RETURNS TABLE
AS
RETURN
    SELECT
        d.IDDireccion,
        d.Alias,
        d.NombreDestinatario,
        d.Telefono,
        Texto = CAST(CONCAT(d.Linea1,
                            N', ' + d.Linea2,
                            CASE WHEN d.Zona IS NOT NULL THEN CONCAT(N', zona ', d.Zona) END,
                            N', ', d.Municipio,
                            N', ', dep.Nombre,
                            N'. Referencia: ' + d.Referencia) AS NVARCHAR(1000))
    FROM dbo.Direccion d
    INNER JOIN dbo.Departamento dep ON dep.IDDepartamento = d.IDDepartamento
    WHERE d.IDDireccion = @IDDireccion;
GO

-- Desglose del IVA (12 %) de un monto que ya lo incluye
CREATE OR ALTER FUNCTION dbo.FU_Pedidos_DesgloseIVA (@Total DECIMAL(12,2))
RETURNS TABLE
AS
RETURN
    SELECT
        BaseImponible = CAST(ROUND(@Total / 1.12, 2) AS DECIMAL(12,2)),
        MontoIVA      = CAST(@Total - ROUND(@Total / 1.12, 2) AS DECIMAL(12,2));
GO

-- Primer día del periodo (día, semana que inicia en lunes, o mes) para agrupar reportes.
-- Uso DATEDIFF contra 1900-01-01 (que fue lunes) para no depender de SET DATEFIRST.
CREATE OR ALTER FUNCTION dbo.FU_Dashboard_InicioPeriodo (@Fecha DATE, @Agrupacion VARCHAR(6))
RETURNS TABLE
AS
RETURN
    SELECT InicioPeriodo = CASE @Agrupacion
        WHEN 'SEMANA' THEN DATEADD(DAY, -(DATEDIFF(DAY, CAST('19000101' AS DATE), @Fecha) % 7), @Fecha)
        WHEN 'MES'    THEN DATEFROMPARTS(YEAR(@Fecha), MONTH(@Fecha), 1)
        ELSE @Fecha
    END;
GO
