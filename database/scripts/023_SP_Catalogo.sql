/* =============================================================================
   ShopCart · 023 · SPs de catálogo (categorías, productos y variantes)
   -----------------------------------------------------------------------------
   - Lectura pública: solo productos activos, de categorías activas y con al
     menos una variante activa. El administrador puede pedir también inactivos.
   - Los productos con ventas o movimientos de inventario no se borran: se
     desactivan y dejan de verse en la tienda.
   - La existencia inicial de una variante entra por el kardex (ENTRADA_COMPRA),
     así la existencia siempre cuadra con la suma de movimientos.
   - El precio se cambia con su propio SP; el trigger deja en bitácora el
     precio anterior y el nuevo. Los pedidos ya hechos no cambian porque guardan
     su propio precio.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

/* --- Categorías ------------------------------------------------------------ */

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategorias
    @IncluirInactivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo, c.FechaCreacion, c.FechaActualizacion,
           ProductosActivos = (SELECT COUNT(*) FROM dbo.Producto p WHERE p.IDCategoria = c.IDCategoria AND p.Activo = 1)
    FROM dbo.Categoria c
    WHERE @IncluirInactivas = 1 OR c.Activo = 1
    ORDER BY c.Nombre;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerCategoria
    @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo, c.FechaCreacion, c.FechaActualizacion,
           ProductosActivos = (SELECT COUNT(*) FROM dbo.Producto p WHERE p.IDCategoria = c.IDCategoria AND p.Activo = 1)
    FROM dbo.Categoria c
    WHERE c.IDCategoria = @IDCategoria;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearCategoria
    @IDUsuarioAccion INT,
    @Nombre          NVARCHAR(100),
    @Descripcion     NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDCategoria INT;
    SET @Nombre = LTRIM(RTRIM(@Nombre));

    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Nombre = @Nombre)
        THROW 52002, N'Ya existe una categoría con ese nombre.', 1;

    BEGIN TRY
        INSERT INTO dbo.Categoria (Nombre, Descripcion) VALUES (@Nombre, NULLIF(LTRIM(RTRIM(@Descripcion)), N''));
        SET @IDCategoria = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 52002, N'Ya existe una categoría con ese nombre.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarCategoria
    @IDUsuarioAccion INT,
    @IDCategoria     INT,
    @Nombre          NVARCHAR(100),
    @Descripcion     NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    SET @Nombre = LTRIM(RTRIM(@Nombre));

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Nombre = @Nombre AND IDCategoria <> @IDCategoria)
        THROW 52002, N'Ya existe una categoría con ese nombre.', 1;

    UPDATE dbo.Categoria
    SET Nombre = @Nombre, Descripcion = NULLIF(LTRIM(RTRIM(@Descripcion)), N''), FechaActualizacion = SYSUTCDATETIME()
    WHERE IDCategoria = @IDCategoria;

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoCategoria
    @IDUsuarioAccion INT,
    @IDCategoria     INT,
    @Activo          BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;

    UPDATE dbo.Categoria
    SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
    WHERE IDCategoria = @IDCategoria;

    EXEC dbo.SP_Catalogo_ObtenerCategoria @IDCategoria;
END;
GO

-- Solo se borra si nunca tuvo productos ni cupones; si no, hay que desactivarla
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarCategoria
    @IDUsuarioAccion INT,
    @IDCategoria     INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Producto WHERE IDCategoria = @IDCategoria)
       OR EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCategoria = @IDCategoria)
       OR EXISTS (SELECT 1 FROM dbo.PedidoDetalle WHERE IDCategoria = @IDCategoria)
        THROW 52003, N'La categoría tiene productos, cupones o ventas asociadas; desactívala en lugar de eliminarla.', 1;

    DELETE FROM dbo.Categoria WHERE IDCategoria = @IDCategoria;
    SELECT Resultado = 'ELIMINADA', IDCategoria = @IDCategoria;
END;
GO

/* --- Productos ------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto              NVARCHAR(100) = NULL,
    @IDCategoria        INT           = NULL,
    @PrecioMin          DECIMAL(12,2) = NULL,
    @PrecioMax          DECIMAL(12,2) = NULL,
    @SoloDisponibles    BIT           = 0,
    @OrdenarPor         VARCHAR(12)   = 'RECIENTES',   -- NOMBRE | PRECIO | RECIENTES
    @Direccion          VARCHAR(4)    = 'DESC',        -- ASC | DESC
    @Pagina             INT           = 1,
    @TamanoPagina       INT           = 20,
    @IncluirInactivos   BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;
    IF @OrdenarPor NOT IN ('NOMBRE', 'PRECIO', 'RECIENTES') OR @Direccion NOT IN ('ASC', 'DESC')
        THROW 50001, N'Ordenamiento inválido.', 1;
    IF @PrecioMin IS NOT NULL AND @PrecioMax IS NOT NULL AND @PrecioMin > @PrecioMax
        THROW 50001, N'El precio mínimo no puede ser mayor que el precio máximo.', 1;

    DECLARE @Patron NVARCHAR(320) = (SELECT Patron FROM dbo.FU_Sistema_PatronBusqueda(@Texto));

    WITH Productos AS (
        SELECT
            p.IDProducto, p.Nombre, p.Descripcion, p.Marca, p.IDCategoria, Categoria = c.Nombre,
            p.Activo, p.FechaCreacion,
            vr.PrecioMinimo, vr.PrecioMaximo, vr.Disponible, vr.Variantes,
            ImagenUrl = (SELECT TOP (1) i.Url FROM dbo.ProductoImagen i WHERE i.IDProducto = p.IDProducto ORDER BY i.Orden)
        FROM dbo.Producto p
        INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
        CROSS APPLY (
            SELECT PrecioMinimo = MIN(v.Precio),
                   PrecioMaximo = MAX(v.Precio),
                   Disponible   = ISNULL(SUM(v.Disponible), 0),
                   Variantes    = COUNT(*)
            FROM dbo.Variante v
            WHERE v.IDProducto = p.IDProducto
              AND (v.Activo = 1 OR @IncluirInactivos = 1)
        ) vr
        WHERE (@IncluirInactivos = 1 OR (p.Activo = 1 AND c.Activo = 1 AND vr.Variantes > 0))
          AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
          AND (@Patron IS NULL
               OR p.Nombre LIKE @Patron
               OR p.Marca LIKE @Patron
               OR p.Descripcion LIKE @Patron
               OR EXISTS (SELECT 1 FROM dbo.Variante vs WHERE vs.IDProducto = p.IDProducto AND vs.SKU LIKE @Patron))
          AND ((@PrecioMin IS NULL AND @PrecioMax IS NULL)
               OR EXISTS (SELECT 1 FROM dbo.Variante vp
                          WHERE vp.IDProducto = p.IDProducto
                            AND (vp.Activo = 1 OR @IncluirInactivos = 1)
                            AND (@PrecioMin IS NULL OR vp.Precio >= @PrecioMin)
                            AND (@PrecioMax IS NULL OR vp.Precio <= @PrecioMax)))
          AND (@SoloDisponibles = 0 OR vr.Disponible > 0)
    )
    SELECT IDProducto, Nombre, Descripcion, Marca, IDCategoria, Categoria, Activo,
           PrecioMinimo, PrecioMaximo, Disponible, CantidadVariantes = Variantes, ImagenUrl, FechaCreacion,
           TotalRegistros = COUNT(*) OVER ()
    FROM Productos
    ORDER BY
        CASE WHEN @OrdenarPor = 'NOMBRE'    AND @Direccion = 'ASC'  THEN Nombre END ASC,
        CASE WHEN @OrdenarPor = 'NOMBRE'    AND @Direccion = 'DESC' THEN Nombre END DESC,
        CASE WHEN @OrdenarPor = 'PRECIO'    AND @Direccion = 'ASC'  THEN PrecioMinimo END ASC,
        CASE WHEN @OrdenarPor = 'PRECIO'    AND @Direccion = 'DESC' THEN PrecioMinimo END DESC,
        CASE WHEN @OrdenarPor = 'RECIENTES' AND @Direccion = 'ASC'  THEN FechaCreacion END ASC,
        CASE WHEN @OrdenarPor = 'RECIENTES' AND @Direccion = 'DESC' THEN FechaCreacion END DESC,
        IDProducto DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

-- Devuelve 3 resultados: el producto, sus variantes (con atributos en JSON) y sus imágenes
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto         INT,
    @IncluirInactivos   BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1
                   FROM dbo.Producto p
                   INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
                   WHERE p.IDProducto = @IDProducto
                     AND (@IncluirInactivos = 1 OR (p.Activo = 1 AND c.Activo = 1)))
        THROW 52011, N'El producto no existe o ya no está disponible.', 1;

    SELECT p.IDProducto, p.Nombre, p.Descripcion, p.Marca, p.IDCategoria, Categoria = c.Nombre, p.Activo,
           p.FechaCreacion, p.FechaActualizacion,
           PrecioMinimo = (SELECT MIN(v.Precio) FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto AND v.Activo = 1),
           PrecioMaximo = (SELECT MAX(v.Precio) FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto AND v.Activo = 1),
           Disponible   = ISNULL((SELECT SUM(v.Disponible) FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto AND v.Activo = 1), 0)
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    SELECT vd.IDVariante, vd.SKU, vd.Precio, vd.Existencia, vd.Reservada, vd.Disponible,
           Activo = vd.VarianteActiva, vd.DescripcionVariante,
           Atributos = (SELECT a.Nombre AS nombre, av.Valor AS valor
                        FROM dbo.VarianteAtributo va
                        INNER JOIN dbo.Atributo a       ON a.IDAtributo = va.IDAtributo
                        INNER JOIN dbo.AtributoValor av ON av.IDAtributoValor = va.IDAtributoValor
                        WHERE va.IDVariante = vd.IDVariante
                        ORDER BY a.Nombre
                        FOR JSON PATH)
    FROM dbo.VW_Catalogo_VarianteDetalle vd
    WHERE vd.IDProducto = @IDProducto
      AND (@IncluirInactivos = 1 OR vd.VarianteActiva = 1)
    ORDER BY vd.SKU;

    SELECT IDProductoImagen, Url, TextoAlternativo, Orden
    FROM dbo.ProductoImagen
    WHERE IDProducto = @IDProducto
    ORDER BY Orden;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDUsuarioAccion INT,
    @IDCategoria     INT,
    @Nombre          NVARCHAR(150),
    @Descripcion     NVARCHAR(2000) = NULL,
    @Marca           NVARCHAR(80)   = NULL,
    @Imagenes        dbo.TT_Catalogo_Imagen READONLY,
    @Variantes       dbo.TT_Catalogo_Variante READONLY,
    @Atributos       dbo.TT_Catalogo_AtributoVariante READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDProducto INT, @Mensaje NVARCHAR(2000), @Lista NVARCHAR(1500);
    DECLARE @IDTipoEntrada INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'ENTRADA_COMPRA');
    DECLARE @Mapa TABLE (Clave INT PRIMARY KEY, IDVariante INT NOT NULL);
    DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

    -- Validaciones ----------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND Activo = 0)
        THROW 52004, N'La categoría está desactivada; actívala antes de agregarle productos.', 1;
    IF NOT EXISTS (SELECT 1 FROM @Variantes)
        THROW 52012, N'El producto debe tener al menos una variante.', 1;
    IF EXISTS (SELECT 1 FROM @Variantes WHERE Precio <= 0 OR ExistenciaInicial < 0)
        THROW 52024, N'Cada variante necesita un precio mayor a cero y una existencia inicial que no sea negativa.', 1;

    SELECT @Lista = STRING_AGG(CAST(SKU AS NVARCHAR(40)), N', ')
    FROM (SELECT SKU = UPPER(LTRIM(RTRIM(SKU))) FROM @Variantes GROUP BY UPPER(LTRIM(RTRIM(SKU))) HAVING COUNT(*) > 1) x;
    IF @Lista IS NOT NULL
    BEGIN
        SET @Mensaje = CONCAT(N'Hay SKU repetidos en las variantes: ', @Lista, N'.');
        THROW 52022, @Mensaje, 1;
    END;

    SELECT @Lista = STRING_AGG(CAST(v.SKU AS NVARCHAR(40)), N', ')
    FROM dbo.Variante v
    INNER JOIN @Variantes n ON UPPER(LTRIM(RTRIM(n.SKU))) = v.SKU;
    IF @Lista IS NOT NULL
    BEGIN
        SET @Mensaje = CONCAT(N'Estos SKU ya existen en el catálogo: ', @Lista, N'.');
        THROW 52022, @Mensaje, 1;
    END;

    IF EXISTS (SELECT 1 FROM @Atributos a WHERE NOT EXISTS (SELECT 1 FROM @Variantes v WHERE v.Clave = a.ClaveVariante))
        THROW 50001, N'Hay atributos que no corresponden a ninguna variante.', 1;
    IF EXISTS (SELECT 1 FROM @Atributos WHERE LEN(LTRIM(Atributo)) = 0 OR LEN(LTRIM(Valor)) = 0)
        THROW 50001, N'Los atributos y sus valores no pueden ir vacíos.', 1;

    -- Dos variantes del mismo producto no pueden tener exactamente los mismos atributos
    IF EXISTS (
        SELECT f.Firma
        FROM (SELECT v.Clave,
                     Firma = ISNULL((SELECT STRING_AGG(CAST(CONCAT(LTRIM(RTRIM(a.Atributo)), N'=', LTRIM(RTRIM(a.Valor))) AS NVARCHAR(120)), N'|')
                                            WITHIN GROUP (ORDER BY a.Atributo)
                                     FROM @Atributos a WHERE a.ClaveVariante = v.Clave), N'')
              FROM @Variantes v) f
        GROUP BY f.Firma
        HAVING COUNT(*) > 1)
        THROW 52023, N'Hay variantes con la misma combinación de atributos.', 1;

    -- Inserción ---------------------------------------------------------------
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Marca)
        VALUES (@IDCategoria, LTRIM(RTRIM(@Nombre)), NULLIF(LTRIM(RTRIM(@Descripcion)), N''), NULLIF(LTRIM(RTRIM(@Marca)), N''));
        SET @IDProducto = SCOPE_IDENTITY();

        INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
        SELECT @IDProducto, Url, TextoAlternativo, Orden FROM @Imagenes;

        -- Atributos y valores nuevos (los existentes se reutilizan)
        INSERT INTO dbo.Atributo (Nombre)
        SELECT DISTINCT LTRIM(RTRIM(a.Atributo))
        FROM @Atributos a
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Atributo x WITH (UPDLOCK, HOLDLOCK) WHERE x.Nombre = LTRIM(RTRIM(a.Atributo)));

        INSERT INTO dbo.AtributoValor (IDAtributo, Valor)
        SELECT DISTINCT at.IDAtributo, LTRIM(RTRIM(a.Valor))
        FROM @Atributos a
        INNER JOIN dbo.Atributo at ON at.Nombre = LTRIM(RTRIM(a.Atributo))
        WHERE NOT EXISTS (SELECT 1 FROM dbo.AtributoValor x WITH (UPDLOCK, HOLDLOCK)
                          WHERE x.IDAtributo = at.IDAtributo AND x.Valor = LTRIM(RTRIM(a.Valor)));

        -- MERGE con ON 1 = 0 solo para poder relacionar la Clave de cada fila con su IDVariante
        MERGE INTO dbo.Variante AS destino
        USING @Variantes AS origen ON 1 = 0
        WHEN NOT MATCHED THEN
            INSERT (IDProducto, SKU, Precio)
            VALUES (@IDProducto, UPPER(LTRIM(RTRIM(origen.SKU))), origen.Precio)
        OUTPUT origen.Clave, inserted.IDVariante INTO @Mapa (Clave, IDVariante);

        INSERT INTO dbo.VarianteAtributo (IDVariante, IDAtributo, IDAtributoValor)
        SELECT m.IDVariante, at.IDAtributo, av.IDAtributoValor
        FROM @Atributos a
        INNER JOIN @Mapa m              ON m.Clave = a.ClaveVariante
        INNER JOIN dbo.Atributo at      ON at.Nombre = LTRIM(RTRIM(a.Atributo))
        INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = LTRIM(RTRIM(a.Valor));

        -- Existencia inicial por kardex
        UPDATE v
        SET v.Existencia = v.Existencia + n.ExistenciaInicial,
            v.FechaActualizacion = SYSUTCDATETIME()
        OUTPUT inserted.IDVariante, n.ExistenciaInicial, deleted.Existencia, inserted.Existencia
            INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
        FROM dbo.Variante v
        INNER JOIN @Mapa m      ON m.IDVariante = v.IDVariante
        INNER JOIN @Variantes n ON n.Clave = m.Clave
        WHERE n.ExistenciaInicial > 0;

        INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario)
        SELECT IDVariante, @IDTipoEntrada, Cantidad, Anterior, Nueva, N'Inventario inicial al registrar el producto', @IDUsuarioAccion
        FROM @Movimientos;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Variante_SKU%'
            THROW 52022, N'Uno de los SKU ya existe en el catálogo.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto, 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDUsuarioAccion INT,
    @IDProducto      INT,
    @IDCategoria     INT,
    @Nombre          NVARCHAR(150),
    @Descripcion     NVARCHAR(2000) = NULL,
    @Marca           NVARCHAR(80)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 52011, N'El producto no existe.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 52001, N'La categoría no existe.', 1;

    UPDATE dbo.Producto
    SET IDCategoria = @IDCategoria,
        Nombre = LTRIM(RTRIM(@Nombre)),
        Descripcion = NULLIF(LTRIM(RTRIM(@Descripcion)), N''),
        Marca = NULLIF(LTRIM(RTRIM(@Marca)), N''),
        FechaActualizacion = SYSUTCDATETIME()
    WHERE IDProducto = @IDProducto;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto, 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ReemplazarImagenes
    @IDUsuarioAccion INT,
    @IDProducto      INT,
    @Imagenes        dbo.TT_Catalogo_Imagen READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 52011, N'El producto no existe.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DELETE FROM dbo.ProductoImagen WHERE IDProducto = @IDProducto;
        INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
        SELECT @IDProducto, Url, TextoAlternativo, Orden FROM @Imagenes;
        UPDATE dbo.Producto SET FechaActualizacion = SYSUTCDATETIME() WHERE IDProducto = @IDProducto;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto, 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoProducto
    @IDUsuarioAccion INT,
    @IDProducto      INT,
    @Activo          BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 52011, N'El producto no existe.', 1;

    UPDATE dbo.Producto
    SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
    WHERE IDProducto = @IDProducto;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto, 1;
END;
GO

-- Si el producto tuvo ventas, movimientos o checkouts se desactiva; si no, se elimina
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarProducto
    @IDUsuarioAccion INT,
    @IDProducto      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @Resultado VARCHAR(12);

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 52011, N'El producto no existe.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM dbo.Variante v
                   WHERE v.IDProducto = @IDProducto
                     AND (EXISTS (SELECT 1 FROM dbo.PedidoDetalle d WHERE d.IDVariante = v.IDVariante)
                          OR EXISTS (SELECT 1 FROM dbo.Kardex k WHERE k.IDVariante = v.IDVariante)
                          OR EXISTS (SELECT 1 FROM dbo.CheckoutDetalle cd WHERE cd.IDVariante = v.IDVariante)))
        BEGIN
            UPDATE dbo.Producto
            SET Activo = 0, FechaActualizacion = SYSUTCDATETIME()
            WHERE IDProducto = @IDProducto AND Activo = 1;
            SET @Resultado = 'DESACTIVADO';
        END
        ELSE
        BEGIN
            -- Nunca se vendió ni tuvo movimientos: se puede borrar sin perder historia
            DELETE cd FROM dbo.CarritoDetalle cd
            INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
            WHERE v.IDProducto = @IDProducto;

            DELETE FROM dbo.Variante WHERE IDProducto = @IDProducto;
            DELETE FROM dbo.Producto WHERE IDProducto = @IDProducto;
            SET @Resultado = 'ELIMINADO';
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT Resultado = @Resultado, IDProducto = @IDProducto;
END;
GO

/* --- Variantes ------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_AgregarVariante
    @IDUsuarioAccion    INT,
    @IDProducto         INT,
    @SKU                VARCHAR(40),
    @Precio             DECIMAL(12,2),
    @ExistenciaInicial  INT = 0,
    @Atributos          dbo.TT_Catalogo_AtributoVariante READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDVariante INT, @Firma NVARCHAR(1000), @Mensaje NVARCHAR(400);
    DECLARE @IDTipoEntrada INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'ENTRADA_COMPRA');
    SET @SKU = UPPER(LTRIM(RTRIM(@SKU)));

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 52011, N'El producto no existe.', 1;
    IF @Precio IS NULL OR @Precio <= 0 OR @ExistenciaInicial < 0
        THROW 52024, N'La variante necesita un precio mayor a cero y una existencia inicial que no sea negativa.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Variante WHERE SKU = @SKU)
    BEGIN
        SET @Mensaje = CONCAT(N'El SKU ', @SKU, N' ya existe en el catálogo.');
        THROW 52022, @Mensaje, 1;
    END;
    IF EXISTS (SELECT 1 FROM @Atributos WHERE LEN(LTRIM(Atributo)) = 0 OR LEN(LTRIM(Valor)) = 0)
        THROW 50001, N'Los atributos y sus valores no pueden ir vacíos.', 1;

    SET @Firma = ISNULL((SELECT STRING_AGG(CAST(CONCAT(LTRIM(RTRIM(Atributo)), N'=', LTRIM(RTRIM(Valor))) AS NVARCHAR(120)), N'|')
                                WITHIN GROUP (ORDER BY Atributo)
                         FROM @Atributos), N'');
    IF EXISTS (SELECT 1 FROM dbo.Variante v
               OUTER APPLY dbo.FU_Catalogo_FirmaVariante(v.IDVariante) f
               WHERE v.IDProducto = @IDProducto AND ISNULL(f.Firma, N'') = @Firma)
        THROW 52023, N'El producto ya tiene una variante con esa combinación de atributos.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.Atributo (Nombre)
        SELECT DISTINCT LTRIM(RTRIM(a.Atributo))
        FROM @Atributos a
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Atributo x WITH (UPDLOCK, HOLDLOCK) WHERE x.Nombre = LTRIM(RTRIM(a.Atributo)));

        INSERT INTO dbo.AtributoValor (IDAtributo, Valor)
        SELECT DISTINCT at.IDAtributo, LTRIM(RTRIM(a.Valor))
        FROM @Atributos a
        INNER JOIN dbo.Atributo at ON at.Nombre = LTRIM(RTRIM(a.Atributo))
        WHERE NOT EXISTS (SELECT 1 FROM dbo.AtributoValor x WITH (UPDLOCK, HOLDLOCK)
                          WHERE x.IDAtributo = at.IDAtributo AND x.Valor = LTRIM(RTRIM(a.Valor)));

        INSERT INTO dbo.Variante (IDProducto, SKU, Precio) VALUES (@IDProducto, @SKU, @Precio);
        SET @IDVariante = SCOPE_IDENTITY();

        INSERT INTO dbo.VarianteAtributo (IDVariante, IDAtributo, IDAtributoValor)
        SELECT @IDVariante, at.IDAtributo, av.IDAtributoValor
        FROM @Atributos a
        INNER JOIN dbo.Atributo at      ON at.Nombre = LTRIM(RTRIM(a.Atributo))
        INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = LTRIM(RTRIM(a.Valor));

        IF @ExistenciaInicial > 0
        BEGIN
            UPDATE dbo.Variante SET Existencia = @ExistenciaInicial, FechaActualizacion = SYSUTCDATETIME()
            WHERE IDVariante = @IDVariante;

            INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario)
            VALUES (@IDVariante, @IDTipoEntrada, @ExistenciaInicial, 0, @ExistenciaInicial,
                    N'Inventario inicial al registrar la variante', @IDUsuarioAccion);
        END;

        UPDATE dbo.Producto SET FechaActualizacion = SYSUTCDATETIME() WHERE IDProducto = @IDProducto;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Variante_SKU%'
            THROW 52022, N'Ese SKU ya existe en el catálogo.', 1;
        THROW;
    END CATCH;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto, 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarPrecioVariante
    @IDUsuarioAccion INT,
    @IDVariante      INT,
    @Precio          DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @PrecioAnterior DECIMAL(12,2), @IDProducto INT;

    SELECT @PrecioAnterior = Precio, @IDProducto = IDProducto FROM dbo.Variante WHERE IDVariante = @IDVariante;
    IF @IDProducto IS NULL
        THROW 52021, N'La variante no existe.', 1;
    IF @Precio IS NULL OR @Precio <= 0
        THROW 52024, N'El precio debe ser mayor a cero.', 1;

    UPDATE dbo.Variante
    SET Precio = @Precio, FechaActualizacion = SYSUTCDATETIME()
    WHERE IDVariante = @IDVariante;

    SELECT vd.IDVariante, vd.IDProducto, vd.SKU, PrecioAnterior = @PrecioAnterior, PrecioNuevo = vd.Precio,
           vd.NombreProducto, vd.DescripcionVariante, vd.Disponible
    FROM dbo.VW_Catalogo_VarianteDetalle vd
    WHERE vd.IDVariante = @IDVariante;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoVariante
    @IDUsuarioAccion INT,
    @IDVariante      INT,
    @Activo          BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 52021, N'La variante no existe.', 1;

    UPDATE dbo.Variante
    SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
    WHERE IDVariante = @IDVariante;

    SELECT vd.IDVariante, vd.IDProducto, vd.SKU, vd.Precio, vd.Disponible, Activo = vd.VarianteActiva,
           vd.NombreProducto, vd.DescripcionVariante
    FROM dbo.VW_Catalogo_VarianteDetalle vd
    WHERE vd.IDVariante = @IDVariante;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarAtributos
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.IDAtributo, a.Nombre,
           Valores = (SELECT av.IDAtributoValor AS id, av.Valor AS valor
                      FROM dbo.AtributoValor av
                      WHERE av.IDAtributo = a.IDAtributo
                      ORDER BY av.Valor
                      FOR JSON PATH)
    FROM dbo.Atributo a
    ORDER BY a.Nombre;
END;
GO
