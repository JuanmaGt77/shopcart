/* =============================================================================
   ShopCart · 052 · Datos semilla: catálogo
   -----------------------------------------------------------------------------
   8 categorías y 32 productos. Las variantes se generan combinando tallas (o
   capacidades) con colores, cada una con su SKU. Si una talla trae ":precio",
   esa variante tiene un precio distinto (por ejemplo, los termos por capacidad).
   La existencia inicial entra al kardex como ENTRADA_COMPRA hace 100 días, así
   la existencia siempre coincide con la suma de movimientos.
   Las imágenes son de picsum.photos (solo para que el frontend tenga qué mostrar).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

DISABLE TRIGGER dbo.TR_Categoria_Bitacora ON dbo.Categoria;
DISABLE TRIGGER dbo.TR_Producto_Bitacora ON dbo.Producto;
DISABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
GO

DECLARE @FechaAlta DATETIME2(3) = DATEADD(DAY, -100, SYSUTCDATETIME());
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'admin@shopcart.test');
DECLARE @IDTipoEntrada INT = (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'ENTRADA_COMPRA');

INSERT INTO dbo.Categoria (Nombre, Descripcion, FechaCreacion) VALUES
    (N'Playeras',          N'Playeras de algodón, deportivas y estampadas.', @FechaAlta),
    (N'Sudaderas',         N'Sudaderas, chumpas y rompevientos.',            @FechaAlta),
    (N'Pantalones',        N'Jeans, joggers, cargo y shorts.',               @FechaAlta),
    (N'Calzado',           N'Tenis, sandalias y botas.',                      @FechaAlta),
    (N'Gorras',            N'Gorras y sombreros.',                            @FechaAlta),
    (N'Mochilas',          N'Mochilas, bolsos y cangureras.',                 @FechaAlta),
    (N'Termos y botellas', N'Termos, botellas y tazas térmicas.',             @FechaAlta),
    (N'Audio',             N'Audífonos y bocinas.',                           @FechaAlta);

DECLARE @Productos TABLE (
    Clave       INT PRIMARY KEY,
    Codigo      VARCHAR(8),
    Categoria   NVARCHAR(100),
    Nombre      NVARCHAR(150),
    Marca       NVARCHAR(80),
    Descripcion NVARCHAR(400),
    Precio      DECIMAL(12,2),
    AtributoA   NVARCHAR(50),     -- Talla / Capacidad (NULL si no aplica)
    ValoresA    NVARCHAR(200),
    Colores     NVARCHAR(200)
);

INSERT INTO @Productos VALUES
 ( 1, 'PLABAS', N'Playeras', N'Playera básica de algodón', N'Telar Chapín', N'Playera 100 % algodón peinado, corte regular y cuello redondo reforzado.', 79.00, N'Talla', N'S,M,L,XL', N'Negro,Blanco,Azul marino'),
 ( 2, 'PLACUV', N'Playeras', N'Playera cuello V', N'Telar Chapín', N'Algodón suave con cuello en V, ideal para el día a día.', 89.00, N'Talla', N'S,M,L,XL', N'Negro,Gris'),
 ( 3, 'PLADRY', N'Playeras', N'Playera deportiva dry-fit', N'Pacaya Sport', N'Tela que seca rápido, perfecta para correr o ir al gimnasio.', 119.00, N'Talla', N'S,M,L,XL', N'Negro,Rojo,Azul'),
 ( 4, 'PLAVOL', N'Playeras', N'Playera estampada Volcán de Agua', N'Hecho en Xela', N'Estampado serigrafiado a mano del Volcán de Agua.', 109.00, N'Talla', N'S,M,L,XL', N'Blanco,Negro'),
 ( 5, 'PLAATI', N'Playeras', N'Playera Lago de Atitlán', N'Hecho en Xela', N'Diseño inspirado en los atardeceres del lago.', 109.00, N'Talla', N'S,M,L,XL', N'Blanco,Celeste'),
 ( 6, 'PLAPOL', N'Playeras', N'Playera polo piqué', N'Telar Chapín', N'Polo de piqué con botones de nácar, ideal para la oficina.', 149.00, N'Talla', N'S,M,L,XL', N'Blanco,Azul marino,Verde'),
 ( 7, 'SUDCAP', N'Sudaderas', N'Sudadera con capucha clásica', N'Pacaya Sport', N'Felpa por dentro, bolsa canguro y capucha ajustable.', 299.00, N'Talla', N'S,M,L,XL', N'Gris,Negro'),
 ( 8, 'SUDRED', N'Sudaderas', N'Sudadera cuello redondo', N'Telar Chapín', N'Sudadera ligera de algodón para las mañanas frías.', 249.00, N'Talla', N'S,M,L,XL', N'Azul marino,Beige'),
 ( 9, 'SUDROM', N'Sudaderas', N'Chumpa rompevientos', N'Pacaya Sport', N'Rompevientos impermeable con capucha que se guarda en el cuello.', 349.00, N'Talla', N'S,M,L,XL', N'Negro,Verde olivo'),
 (10, 'SUDQUE', N'Sudaderas', N'Sudadera Quetzal bordado', N'Hecho en Xela', N'Quetzal bordado en el pecho, edición nacional.', 329.00, N'Talla', N'S,M,L,XL', N'Negro,Blanco'),
 (11, 'PANJEA', N'Pantalones', N'Jeans corte recto', N'Denim 502', N'Mezclilla de 12 oz con un toque de elastano.', 329.00, N'Talla', N'28,30,32,34,36', N'Azul,Negro'),
 (12, 'PANJOG', N'Pantalones', N'Jogger deportivo', N'Pacaya Sport', N'Jogger con puños elásticos y bolsas con zíper.', 229.00, N'Talla', N'S,M,L,XL', N'Gris,Negro'),
 (13, 'PANCAR', N'Pantalones', N'Pantalón cargo', N'Denim 502', N'Pantalón cargo de gabardina con seis bolsas.', 299.00, N'Talla', N'28,30,32,34,36', N'Beige,Verde olivo'),
 (14, 'PANSHO', N'Pantalones', N'Short deportivo', N'Pacaya Sport', N'Short ligero con forro interior.', 149.00, N'Talla', N'S,M,L,XL', N'Negro,Azul'),
 (15, 'CALURB', N'Calzado', N'Tenis urbanos', N'Paso Firme', N'Tenis de lona con suela vulcanizada.', 499.00, N'Talla', N'37,38,39,40,41,42,43', N'Blanco,Negro'),
 (16, 'CALRUN', N'Calzado', N'Tenis para correr', N'Paso Firme', N'Amortiguación de espuma y malla transpirable.', 699.00, N'Talla', N'38,39,40,41,42,43', N'Negro,Azul'),
 (17, 'CALSAN', N'Calzado', N'Sandalias de playa', N'Monterrico', N'Sandalias de hule antideslizantes.', 129.00, N'Talla', N'37,38,39,40,41,42,43', N'Negro,Café'),
 (18, 'CALBOT', N'Calzado', N'Botas de trabajo', N'Paso Firme', N'Botas de cuero con punta reforzada.', 799.00, N'Talla', N'39,40,41,42,43', N'Café'),
 (19, 'GORSNA', N'Gorras', N'Gorra snapback', N'Chapín Caps', N'Visera plana y ajuste de broche.', 119.00, N'Talla', N'Única', N'Negro,Rojo,Azul'),
 (20, 'GORTRU', N'Gorras', N'Gorra trucker', N'Chapín Caps', N'Frente de espuma y malla trasera.', 109.00, N'Talla', N'Única', N'Negro,Verde'),
 (21, 'GORPES', N'Gorras', N'Sombrero de pescador', N'Chapín Caps', N'Sombrero de algodón para el sol de la costa.', 129.00, N'Talla', N'Única', N'Beige,Negro'),
 (22, 'MOCESC', N'Mochilas', N'Mochila escolar 20 L', N'Ruta Maya', N'Dos compartimentos y respaldo acolchado.', 249.00, NULL, NULL, N'Negro,Azul,Rojo'),
 (23, 'MOCLAP', N'Mochilas', N'Mochila para laptop 15"', N'Ruta Maya', N'Compartimento acolchado para laptop de hasta 15 pulgadas.', 399.00, NULL, NULL, N'Negro,Gris'),
 (24, 'MOCVIA', N'Mochilas', N'Bolso de viaje', N'Ruta Maya', N'Bolso de lona de 40 litros con correa removible.', 449.00, NULL, NULL, N'Negro'),
 (25, 'MOCCAN', N'Mochilas', N'Cangurera', N'Ruta Maya', N'Cangurera con tres bolsas y correa ajustable.', 99.00, NULL, NULL, N'Negro,Verde'),
 (26, 'TERACE', N'Termos y botellas', N'Termo de acero inoxidable', N'Volcán Hogar', N'Mantiene bebidas frías 24 horas y calientes 12 horas.', 149.00, N'Capacidad', N'500 ml:149,750 ml:179', N'Negro,Plateado,Verde'),
 (27, 'TERBOT', N'Termos y botellas', N'Botella deportiva', N'Volcán Hogar', N'Botella libre de BPA con tapa de boquilla.', 59.00, N'Capacidad', N'600 ml:59,1 L:79', N'Transparente,Azul'),
 (28, 'TERTAZ', N'Termos y botellas', N'Taza térmica para café', N'Volcán Hogar', N'Taza con tapa deslizable, perfecta para el café de Antigua.', 119.00, N'Capacidad', N'350 ml', N'Negro,Blanco'),
 (29, 'AUDINE', N'Audio', N'Audífonos inalámbricos in-ear', N'SonidoGT', N'Bluetooth 5.3, estuche de carga y hasta 24 horas de batería.', 399.00, NULL, NULL, N'Negro,Blanco'),
 (30, 'AUDOVE', N'Audio', N'Audífonos over-ear con cancelación de ruido', N'SonidoGT', N'Cancelación activa de ruido y 30 horas de batería.', 899.00, NULL, NULL, N'Negro,Plateado'),
 (31, 'AUDBOC', N'Audio', N'Bocina bluetooth portátil', N'SonidoGT', N'Resistente al agua IPX7 y 12 horas de reproducción.', 349.00, NULL, NULL, N'Negro,Azul,Rojo'),
 (32, 'AUDDEP', N'Audio', N'Audífonos deportivos', N'SonidoGT', N'Ganchos para la oreja y resistencia al sudor.', 249.00, NULL, NULL, N'Negro,Verde');

DECLARE @CodigosColor TABLE (Color NVARCHAR(50) PRIMARY KEY, Codigo VARCHAR(4));
INSERT INTO @CodigosColor VALUES
    (N'Negro', 'NEG'), (N'Blanco', 'BLA'), (N'Azul marino', 'AZM'), (N'Gris', 'GRI'), (N'Rojo', 'ROJ'),
    (N'Azul', 'AZU'), (N'Celeste', 'CEL'), (N'Verde', 'VER'), (N'Beige', 'BEI'), (N'Verde olivo', 'OLI'),
    (N'Café', 'CAF'), (N'Plateado', 'PLT'), (N'Transparente', 'TRA');

-- Productos
INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Marca, FechaCreacion)
SELECT c.IDCategoria, p.Nombre, p.Descripcion, p.Marca, @FechaAlta
FROM @Productos p
INNER JOIN dbo.Categoria c ON c.Nombre = p.Categoria
ORDER BY p.Clave;

-- Dos imágenes por producto
INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
SELECT pr.IDProducto, CONCAT(N'https://picsum.photos/seed/', LOWER(p.Codigo), N'-', n.Orden, N'/800/800'),
       CONCAT(p.Nombre, N' - vista ', n.Orden + 1), n.Orden
FROM @Productos p
INNER JOIN dbo.Producto pr ON pr.Nombre = p.Nombre
CROSS JOIN (VALUES (0), (1)) AS n (Orden);

-- Combinaciones de variantes
DECLARE @Variantes TABLE (
    Clave INT IDENTITY(1,1) PRIMARY KEY,
    IDProducto INT, SKU VARCHAR(40), Precio DECIMAL(12,2),
    AtributoA NVARCHAR(50), ValorA NVARCHAR(50), Color NVARCHAR(50)
);

INSERT INTO @Variantes (IDProducto, SKU, Precio, AtributoA, ValorA, Color)
SELECT pr.IDProducto,
       CONCAT(p.Codigo, '-', cc.Codigo,
              CASE WHEN a.Valor IS NULL THEN '' ELSE '-' + UPPER(REPLACE(REPLACE(REPLACE(a.Valor, ' ', ''), N'Única', 'U'), N'.', '')) END),
       ISNULL(a.Precio, p.Precio),
       p.AtributoA, a.Valor, LTRIM(RTRIM(col.value))
FROM @Productos p
INNER JOIN dbo.Producto pr ON pr.Nombre = p.Nombre
CROSS APPLY STRING_SPLIT(p.Colores, N',') col
INNER JOIN @CodigosColor cc ON cc.Color = LTRIM(RTRIM(col.value))
OUTER APPLY (
    SELECT Valor  = LTRIM(RTRIM(CASE WHEN CHARINDEX(N':', s.value) > 0 THEN LEFT(s.value, CHARINDEX(N':', s.value) - 1) ELSE s.value END)),
           Precio = CASE WHEN CHARINDEX(N':', s.value) > 0 THEN TRY_CAST(SUBSTRING(s.value, CHARINDEX(N':', s.value) + 1, 20) AS DECIMAL(12,2)) END
    FROM STRING_SPLIT(p.ValoresA, N',') s
) a;

INSERT INTO dbo.Variante (IDProducto, SKU, Precio, FechaCreacion)
SELECT IDProducto, SKU, Precio, @FechaAlta FROM @Variantes ORDER BY Clave;

-- Atributos normalizados
INSERT INTO dbo.Atributo (Nombre)
SELECT DISTINCT AtributoA FROM @Variantes WHERE AtributoA IS NOT NULL
UNION
SELECT N'Color';

INSERT INTO dbo.AtributoValor (IDAtributo, Valor)
SELECT DISTINCT at.IDAtributo, v.ValorA
FROM @Variantes v INNER JOIN dbo.Atributo at ON at.Nombre = v.AtributoA
WHERE v.ValorA IS NOT NULL
UNION
SELECT DISTINCT at.IDAtributo, v.Color
FROM @Variantes v CROSS JOIN dbo.Atributo at
WHERE at.Nombre = N'Color';

INSERT INTO dbo.VarianteAtributo (IDVariante, IDAtributo, IDAtributoValor)
SELECT x.IDVariante, at.IDAtributo, av.IDAtributoValor
FROM @Variantes v
INNER JOIN dbo.Variante x       ON x.SKU = v.SKU
INNER JOIN dbo.Atributo at      ON at.Nombre = v.AtributoA
INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = v.ValorA
UNION ALL
SELECT x.IDVariante, at.IDAtributo, av.IDAtributoValor
FROM @Variantes v
INNER JOIN dbo.Variante x       ON x.SKU = v.SKU
INNER JOIN dbo.Atributo at      ON at.Nombre = N'Color'
INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = v.Color;

-- Existencia inicial por kardex: entre 25 y 79 unidades (determinístico a partir del SKU)
DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

UPDATE x
SET x.Existencia = 25 + ABS(CHECKSUM(x.SKU)) % 55
OUTPUT inserted.IDVariante, inserted.Existencia - deleted.Existencia, deleted.Existencia, inserted.Existencia
    INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
FROM dbo.Variante x;

INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario, Fecha)
SELECT IDVariante, @IDTipoEntrada, Cantidad, Anterior, Nueva, N'Inventario inicial de apertura de la tienda en línea', @IDAdmin, @FechaAlta
FROM @Movimientos
ORDER BY IDVariante;

-- Un producto de edición limitada (poca existencia) y uno descontinuado, para probar esos casos
DECLARE @IDLimitada INT;
INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Marca, FechaCreacion)
SELECT IDCategoria, N'Playera Quetzal dorado edición limitada', N'Edición numerada; quedan muy pocas unidades.', N'Hecho en Xela', @FechaAlta
FROM dbo.Categoria WHERE Nombre = N'Playeras';
SET @IDLimitada = SCOPE_IDENTITY();

INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
VALUES (@IDLimitada, N'https://picsum.photos/seed/plaqdo-0/800/800', N'Playera Quetzal dorado', 0);

INSERT INTO dbo.Variante (IDProducto, SKU, Precio, FechaCreacion)
VALUES (@IDLimitada, 'PLAQDO-NEG-M', 249.00, @FechaAlta), (@IDLimitada, 'PLAQDO-NEG-L', 249.00, @FechaAlta);

INSERT INTO dbo.VarianteAtributo (IDVariante, IDAtributo, IDAtributoValor)
SELECT x.IDVariante, at.IDAtributo, av.IDAtributoValor
FROM dbo.Variante x
INNER JOIN (VALUES ('PLAQDO-NEG-M', N'Talla', N'M'), ('PLAQDO-NEG-M', N'Color', N'Negro'),
                   ('PLAQDO-NEG-L', N'Talla', N'L'), ('PLAQDO-NEG-L', N'Color', N'Negro')) AS t (SKU, Atributo, Valor)
        ON t.SKU = x.SKU
INNER JOIN dbo.Atributo at      ON at.Nombre = t.Atributo
INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = t.Valor;

DELETE FROM @Movimientos;
UPDATE x
SET x.Existencia = CASE x.SKU WHEN 'PLAQDO-NEG-M' THEN 3 ELSE 2 END
OUTPUT inserted.IDVariante, inserted.Existencia - deleted.Existencia, deleted.Existencia, inserted.Existencia
    INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
FROM dbo.Variante x
WHERE x.IDProducto = @IDLimitada;

INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario, Fecha)
SELECT IDVariante, @IDTipoEntrada, Cantidad, Anterior, Nueva, N'Lote de edición limitada', @IDAdmin, @FechaAlta
FROM @Movimientos;

-- Producto descontinuado: no aparece en la tienda pero conserva su historia
UPDATE dbo.Producto SET Activo = 0, FechaActualizacion = SYSUTCDATETIME() WHERE Nombre = N'Botas de trabajo';
GO

ENABLE TRIGGER dbo.TR_Categoria_Bitacora ON dbo.Categoria;
ENABLE TRIGGER dbo.TR_Producto_Bitacora ON dbo.Producto;
ENABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
GO
