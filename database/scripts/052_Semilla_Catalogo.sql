/* =============================================================================
   ShopCart · 052 · Datos semilla: catálogo
   -----------------------------------------------------------------------------
   La tienda en línea de una red de estaciones de servicio: 8 categorías y 48
   productos (lubricantes, aditivos y fluidos, cuidado del vehículo, motos,
   accesorios, snacks, bebidas y mercancía). Los precios son de referencia e
   inventados; no se vende combustible ni nada con alcohol.

   Cada producto tiene hasta dos atributos (A y B). Las variantes salen de
   combinar sus valores, cada una con su SKU: CODIGO-B-A (por ejemplo
   LUBSIN-5W30-1G). Si un valor de A trae ":precio", esa variante tiene ese
   precio (¼ galón y 1 galón no cuestan lo mismo); si no, usa el precio base.
   La existencia inicial entra al kardex como ENTRADA_COMPRA hace 100 días, así
   la existencia siempre coincide con la suma de movimientos.

   Las imágenes son genéricas (placehold.co con el nombre del producto y los
   colores de su categoría): no se usan fotos, logos ni empaques de ninguna marca.
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

/* 1. Categorías ------------------------------------------------------------------
   El orden fija el ID. Las pruebas y las demos usan la 1 (Ropa y mercancía) y la
   prueba del cupón por categoría usa la 4 (Lubricantes). */
DECLARE @Categorias TABLE (
    Orden       INT PRIMARY KEY,
    Nombre      NVARCHAR(100),
    Descripcion NVARCHAR(500),
    Fondo       CHAR(6),      -- colores de la imagen genérica
    Texto       CHAR(6)
);

INSERT INTO @Categorias VALUES
    (1, N'Ropa y mercancía',      N'Playeras, gorras, sudaderas y termos para acompañarte en el camino.',          'e8edfb', '1d3f9e'),
    (2, N'Aditivos y fluidos',    N'Aditivos, refrigerantes, líquidos de frenos y de transmisión.',                'fdecea', 'b42318'),
    (3, N'Cuidado del vehículo',  N'Shampoo, ceras, aromatizantes y todo para que tu carro brille por dentro y por fuera.', 'e3f4ef', '0f6b5c'),
    (4, N'Lubricantes',           N'Aceites para motores de gasolina, diésel y motos de las marcas que distribuimos.', 'fff3dc', '8a4b00'),
    (5, N'Motos',                 N'Cascos, guantes, impermeables y seguridad para motoristas.',                   'eceff3', '1f2937'),
    (6, N'Accesorios para auto',  N'Cargadores, soportes, cables pasacorriente y kits de emergencia.',              'eef0ff', '3730a3'),
    (7, N'Snacks y dulces',       N'Manías, chips, dulces típicos y algo para el antojo del viaje.',               'fef1e2', 'a64b00'),
    (8, N'Bebidas y café',        N'Café guatemalteco, agua pura, hidratantes y energizantes. Sin alcohol.',       'e0f2fe', '075985');

INSERT INTO dbo.Categoria (Nombre, Descripcion, FechaCreacion)
SELECT Nombre, Descripcion, @FechaAlta FROM @Categorias ORDER BY Orden;

/* 2. Productos -------------------------------------------------------------------
   Etiqueta: texto corto de la imagen genérica (| = salto de línea). */
DECLARE @Productos TABLE (
    Clave       INT PRIMARY KEY,
    Codigo      VARCHAR(8),
    Categoria   INT,
    Nombre      NVARCHAR(150),
    Marca       NVARCHAR(80),
    Descripcion NVARCHAR(400),
    Etiqueta    NVARCHAR(60),
    Precio      DECIMAL(12,2),
    AtributoA   NVARCHAR(50),
    ValoresA    NVARCHAR(200),
    AtributoB   NVARCHAR(50),
    ValoresB    NVARCHAR(200)
);

INSERT INTO @Productos VALUES
 -- 1. Ropa y mercancía
 ( 1, 'PLABAS', 1, N'Playera de algodón "En ruta"', N'ShopCart', N'Algodón peinado 100 %, cuello redondo reforzado y el estampado "Todo para tu ruta".', N'Playera|En ruta', 79.00, N'Talla', N'S,M,L,XL', N'Color', N'Negro,Azul,Blanco,Gris'),
 ( 2, 'GORTRU', 1, N'Gorra trucker', N'ShopCart', N'Frente de espuma, malla trasera y broche ajustable. Ideal para el sol del camino.', N'Gorra|trucker', 65.00, NULL, NULL, N'Color', N'Azul,Rojo,Negro'),
 ( 3, 'SUDCAP', 1, N'Sudadera con capucha', N'ShopCart', N'Felpa por dentro, bolsa canguro y capucha ajustable para las mañanas frías.', N'Sudadera|con capucha', 189.00, N'Talla', N'S,M,L,XL', N'Color', N'Azul,Gris'),
 ( 4, 'TERACE', 1, N'Termo de acero inoxidable', N'ShopCart', N'Doble pared al vacío: mantiene el café caliente 12 horas y el agua fría 24.', N'Termo de|acero inoxidable', 119.00, N'Capacidad', N'500 ml:119,750 ml:139', N'Color', N'Azul,Negro'),
 -- 2. Aditivos y fluidos
 ( 5, 'ADIINY', 2, N'Aditivo limpiador de inyectores', N'ShopCart Pro', N'Limpia inyectores y válvulas en motores de gasolina. Una botella por tanque lleno.', N'Limpiador de|inyectores', 45.00, N'Presentación', N'150 ml:45,350 ml:85', NULL, NULL),
 ( 6, 'ADIDIE', 2, N'Aditivo para motor diésel', N'ShopCart Pro', N'Mejora la combustión, reduce el humo negro y protege la bomba de inyección.', N'Aditivo|diésel', 49.00, N'Presentación', N'150 ml:49,350 ml:89', NULL, NULL),
 ( 7, 'FLUREF', 2, N'Refrigerante anticongelante', N'Havoline', N'Listo para usar. Evita el sobrecalentamiento y protege el radiador de la corrosión.', N'Refrigerante', 39.00, N'Presentación', N'¼ galón:39,1 galón:115', N'Tipo', N'Verde,Rosado'),
 ( 8, 'FLUFRE', 2, N'Líquido de frenos', N'Castrol', N'Alto punto de ebullición para un frenado seguro. Revisa en tu manual si usa DOT 3 o DOT 4.', N'Líquido|de frenos', 35.00, N'Presentación', N'350 ml:35,1 litro:95', N'Tipo', N'DOT 3,DOT 4'),
 ( 9, 'FLULIM', 2, N'Líquido limpiaparabrisas', N'ShopCart Pro', N'Quita polvo, insectos y grasa del vidrio sin dejar manchas.', N'Limpia|parabrisas', 25.00, N'Presentación', N'1 litro:25,1 galón:65', NULL, NULL),
 (10, 'FLUATF', 2, N'Aceite de transmisión automática', N'Castrol', N'Fluido para cajas automáticas y dirección hidráulica.', N'Aceite de|transmisión', 69.00, N'Presentación', N'¼ galón:69,1 galón:245', N'Tipo', N'Dexron III,Dexron VI'),
 -- 3. Cuidado del vehículo
 (11, 'CUISHA', 3, N'Shampoo con cera', N'ShopCart Pro', N'Lava y encera en un solo paso. pH neutro, no daña la pintura.', N'Shampoo|con cera', 45.00, N'Presentación', N'500 ml:45,1 galón:149', NULL, NULL),
 (12, 'CUICER', 3, N'Cera protectora', N'ShopCart Pro', N'Brillo profundo y protección contra el sol y la lluvia hasta por tres meses.', N'Cera|protectora', 85.00, N'Tipo', N'Líquida:85,En pasta:99', NULL, NULL),
 (13, 'CUILLA', 3, N'Abrillantador de llantas', N'ShopCart Pro', N'Deja las llantas negras y brillantes, y las protege de los rayos UV.', N'Abrillantador|de llantas', 49.00, N'Presentación', N'500 ml:49,1 litro:79', NULL, NULL),
 (14, 'CUIARO', 3, N'Aromatizante para auto', N'ShopCart Pro', N'Aromatizante de rejilla que dura hasta 45 días.', N'Aromatizante', 25.00, N'Aroma', N'Vainilla,Pino,Carro nuevo,Lavanda,Café', NULL, NULL),
 (15, 'CUITOA', 3, N'Toalla de microfibra', N'ShopCart Pro', N'Absorbe sin rayar. Para secar, encerar o limpiar el interior.', N'Toalla de|microfibra', 29.00, N'Tamaño', N'40×40 cm:29,60×80 cm:55', N'Color', N'Azul,Gris,Amarillo'),
 (16, 'CUITAB', 3, N'Limpiador de tablero y vestiduras', N'ShopCart Pro', N'Limpia plástico, vinil y tela; deja un acabado mate sin grasa.', N'Limpiador|de tablero', 45.00, N'Presentación', N'500 ml:45,1 litro:75', NULL, NULL),
 -- 4. Lubricantes
 (17, 'LUBMIN', 4, N'Aceite mineral multigrado', N'1000 Oil', N'Para motores de gasolina con más años de uso. Protección confiable a buen precio.', N'Aceite|mineral', 55.00, N'Presentación', N'¼ galón:55,1 galón:189', N'Viscosidad', N'20W-50,25W-60'),
 (18, 'LUBSEM', 4, N'Aceite semisintético', N'Castrol', N'Mezcla de bases sintéticas y minerales para manejo diario en ciudad y carretera.', N'Aceite|semisintético', 75.00, N'Presentación', N'¼ galón:75,1 galón:259', N'Viscosidad', N'10W-40,20W-50'),
 (19, 'LUBSIN', 4, N'Aceite sintético', N'Petronas', N'Máxima protección desde el arranque en frío. Para motores modernos.', N'Aceite|sintético', 95.00, N'Presentación', N'¼ galón:95,1 galón:329', N'Viscosidad', N'5W-30,10W-40'),
 (20, 'LUBALT', 4, N'Aceite para alto kilometraje', N'Havoline', N'Con acondicionadores de sellos que reducen fugas y consumo de aceite en motores con más de 120,000 km.', N'Aceite alto|kilometraje', 79.00, N'Presentación', N'¼ galón:79,1 galón:275', N'Viscosidad', N'10W-30,20W-50'),
 (21, 'LUBDIE', 4, N'Aceite para motor diésel', N'Havoline', N'Para camiones, pickups y maquinaria diésel. Controla el hollín y el desgaste.', N'Aceite|diésel', 69.00, N'Presentación', N'¼ galón:69,1 galón:239,5 galones:1095', N'Viscosidad', N'15W-40'),
 (22, 'LUBPRE', 4, N'Aceite sintético premium', N'Repsol', N'Sintético de alto desempeño para motores turbo y de inyección directa.', N'Sintético|premium', 89.00, N'Presentación', N'1 litro:89,4 litros:319', N'Viscosidad', N'5W-30,5W-40'),
 (23, 'LUBM4T', 4, N'Aceite para moto 4T', N'Repsol', N'Para motos de cuatro tiempos con embrague húmedo.', N'Aceite|moto 4T', 65.00, N'Presentación', N'1 litro', N'Viscosidad', N'10W-40,20W-50'),
 (24, 'LUBM2T', 4, N'Aceite para moto 2T', N'Resurs', N'Para mezcla en motos y equipos de dos tiempos. Baja emisión de humo.', N'Aceite|moto 2T', 49.00, N'Presentación', N'1 litro:49,¼ galón:55', NULL, NULL),
 (25, 'LUBMON', 4, N'Aceite monogrado SAE 40', N'1000 Oil', N'Producto descontinuado: lo reemplaza el aceite mineral multigrado.', N'Aceite|monogrado', 45.00, N'Presentación', N'¼ galón:45,1 galón:159', N'Viscosidad', N'SAE 40'),
 -- 5. Motos
 (26, 'MOTCAI', 5, N'Casco integral certificado', N'ShopCart Moto', N'Certificación DOT, visor antiempañante y forro desmontable y lavable.', N'Casco|integral', 549.00, N'Talla', N'S,M,L,XL', N'Color', N'Negro,Rojo'),
 (27, 'MOTCAA', 5, N'Casco abierto', N'ShopCart Moto', N'Ligero y fresco, con visor largo. Ideal para la ciudad.', N'Casco|abierto', 349.00, N'Talla', N'M,L,XL', N'Color', N'Negro,Blanco'),
 (28, 'MOTGUA', 5, N'Guantes para moto', N'ShopCart Moto', N'Protección en nudillos, palma reforzada y dedos compatibles con pantalla táctil.', N'Guantes|para moto', 119.00, N'Talla', N'S,M,L,XL', NULL, NULL),
 (29, 'MOTIMP', 5, N'Impermeable de dos piezas', N'ShopCart Moto', N'Chumpa y pantalón con costuras selladas y franjas reflectivas.', N'Impermeable', 169.00, N'Talla', N'M,L,XL', N'Color', N'Amarillo,Negro'),
 (30, 'MOTCHA', 5, N'Chaleco reflectivo', N'ShopCart Moto', N'Alta visibilidad de día y de noche. Ajustable con velcro.', N'Chaleco|reflectivo', 59.00, N'Talla', N'M,L,XL', NULL, NULL),
 (31, 'MOTCAN', 5, N'Candado de disco', N'ShopCart Moto', N'Acero endurecido con alarma de 110 dB y recordatorio de color llamativo.', N'Candado|de disco', 139.00, NULL, NULL, N'Color', N'Negro,Amarillo'),
 -- 6. Accesorios para auto
 (32, 'ACCCAR', 6, N'Cargador doble para carro', N'ShopCart Pro', N'Dos puertos con carga rápida para celular y tablet.', N'Cargador|para carro', 79.00, N'Tipo', N'USB-A:79,USB-C:99', NULL, NULL),
 (33, 'ACCSOP', 6, N'Soporte de celular', N'ShopCart Pro', N'Sujeción firme con una mano y giro de 360°.', N'Soporte|de celular', 69.00, N'Tipo', N'Rejilla:69,Tablero:85', NULL, NULL),
 (34, 'ACCCAB', 6, N'Cables pasacorriente', N'ShopCart Pro', N'Cable de cobre calibre 8 con pinzas aisladas y bolsa para guardarlos.', N'Cables|pasacorriente', 129.00, N'Tamaño', N'2.5 m:129,4 m:179', NULL, NULL),
 (35, 'ACCKIT', 6, N'Kit de emergencia', N'ShopCart Pro', N'Triángulos, linterna, guantes y botiquín. El completo agrega extintor y cables.', N'Kit de|emergencia', 149.00, N'Tipo', N'Básico:149,Completo:299', NULL, NULL),
 (36, 'ACCINF', 6, N'Inflador portátil', N'ShopCart Pro', N'Infla llantas en minutos con medidor digital y apagado automático.', N'Inflador|portátil', 229.00, N'Tipo', N'12 V:229,Inalámbrico:399', NULL, NULL),
 (37, 'ACCPAR', 6, N'Parasol para parabrisas', N'ShopCart Pro', N'Reflectivo y plegable: mantiene fresco el interior del carro.', N'Parasol', 59.00, N'Tamaño', N'Mediano:59,Grande:69', NULL, NULL),
 -- 7. Snacks y dulces
 (38, 'SNAMAN', 7, N'Manías', N'ShopCart', N'Manías tostadas en bolsa de 100 g, para el camino.', N'Manías', 8.00, N'Sabor', N'Natural,Limón y sal,Japonesas', NULL, NULL),
 (39, 'SNAPLA', 7, N'Chips de plátano', N'ShopCart', N'Plátano verde en rodajas, crujiente y recién empacado.', N'Chips|de plátano', 7.00, N'Tamaño', N'50 g:7,150 g:18', N'Sabor', N'Natural,Picante'),
 (40, 'SNADUL', 7, N'Dulces típicos', N'ShopCart', N'Dulces tradicionales guatemaltecos en bolsa de 6 unidades.', N'Dulces|típicos', 15.00, N'Tipo', N'Canillitas de leche,Cocadas,Colochos de guayaba', NULL, NULL),
 (41, 'SNAGAL', 7, N'Galletas rellenas', N'ShopCart', N'Paquete de 6 galletas con relleno cremoso.', N'Galletas|rellenas', 6.00, N'Sabor', N'Vainilla,Chocolate', NULL, NULL),
 (42, 'SNAGRA', 7, N'Barra de granola', N'ShopCart', N'Avena y miel horneadas, energía para el viaje.', N'Barra de|granola', 9.00, N'Sabor', N'Miel,Chocolate,Frutas', NULL, NULL),
 -- 8. Bebidas y café
 (43, 'BEBCAF', 8, N'Café guatemalteco molido', N'ShopCart', N'Café de altura de grano arábica, cosechado y tostado en Guatemala.', N'Café|guatemalteco', 39.00, N'Tamaño', N'250 g:39,454 g:69', N'Tostado', N'Medio,Oscuro'),
 (44, 'BEBAGU', 8, N'Agua pura', N'ShopCart', N'Agua purificada en botella.', N'Agua|pura', 6.00, N'Tamaño', N'600 ml:6,1.5 litros:10', NULL, NULL),
 (45, 'BEBHID', 8, N'Bebida hidratante', N'ShopCart', N'Con electrolitos para recuperarte del calor. Botella de 600 ml.', N'Bebida|hidratante', 12.00, N'Sabor', N'Naranja,Uva,Limón', NULL, NULL),
 (46, 'BEBCFR', 8, N'Café frío en lata', N'ShopCart', N'Café con leche listo para tomar, lata de 250 ml.', N'Café|frío', 15.00, N'Sabor', N'Moca,Vainilla', NULL, NULL),
 (47, 'BEBENE', 8, N'Bebida energizante', N'ShopCart', N'Con cafeína y vitaminas del complejo B. No se vende a menores de edad.', N'Bebida|energizante', 12.00, N'Tamaño', N'250 ml:12,473 ml:18', NULL, NULL);

-- Código corto de cada valor para armar el SKU (solo letras, números y guiones)
DECLARE @CodigosValor TABLE (Valor NVARCHAR(50) PRIMARY KEY, Codigo VARCHAR(8));
INSERT INTO @CodigosValor VALUES
    (N'S', 'S'), (N'M', 'M'), (N'L', 'L'), (N'XL', 'XL'),
    (N'Negro', 'NEG'), (N'Azul', 'AZU'), (N'Blanco', 'BLA'), (N'Gris', 'GRI'), (N'Rojo', 'ROJ'), (N'Amarillo', 'AMA'),
    (N'150 ml', '150ML'), (N'250 ml', '250ML'), (N'350 ml', '350ML'), (N'473 ml', '473ML'), (N'500 ml', '500ML'),
    (N'600 ml', '600ML'), (N'750 ml', '750ML'), (N'1 litro', '1L'), (N'1.5 litros', '15L'), (N'4 litros', '4L'),
    (N'¼ galón', '025G'), (N'1 galón', '1G'), (N'5 galones', '5G'),
    (N'50 g', '50G'), (N'150 g', '150G'), (N'250 g', '250G'), (N'454 g', '454G'),
    (N'40×40 cm', '40X40'), (N'60×80 cm', '60X80'), (N'2.5 m', '25M'), (N'4 m', '4M'), (N'Mediano', 'MED'), (N'Grande', 'GRA'),
    (N'Verde', 'VER'), (N'Rosado', 'ROS'), (N'DOT 3', 'DOT3'), (N'DOT 4', 'DOT4'), (N'Dexron III', 'DX3'), (N'Dexron VI', 'DX6'),
    (N'Líquida', 'LIQ'), (N'En pasta', 'PAS'), (N'USB-A', 'USBA'), (N'USB-C', 'USBC'), (N'Rejilla', 'REJ'), (N'Tablero', 'TAB'),
    (N'Básico', 'BAS'), (N'Completo', 'COM'), (N'12 V', '12V'), (N'Inalámbrico', 'INA'),
    (N'Canillitas de leche', 'CAN'), (N'Cocadas', 'COC'), (N'Colochos de guayaba', 'COL'),
    (N'Vainilla', 'VAI'), (N'Pino', 'PIN'), (N'Carro nuevo', 'CNU'), (N'Lavanda', 'LAV'), (N'Café', 'CAF'),
    (N'20W-50', '20W50'), (N'25W-60', '25W60'), (N'10W-40', '10W40'), (N'5W-30', '5W30'), (N'10W-30', '10W30'),
    (N'15W-40', '15W40'), (N'5W-40', '5W40'), (N'SAE 40', 'SAE40'),
    (N'Natural', 'NAT'), (N'Limón y sal', 'LYS'), (N'Japonesas', 'JAP'), (N'Picante', 'PIC'), (N'Chocolate', 'CHO'),
    (N'Miel', 'MIE'), (N'Frutas', 'FRU'), (N'Naranja', 'NAR'), (N'Uva', 'UVA'), (N'Limón', 'LIM'), (N'Moca', 'MOC'),
    (N'Medio', 'TME'), (N'Oscuro', 'TOS');

-- Productos
INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Marca, FechaCreacion)
SELECT c.IDCategoria, p.Nombre, p.Descripcion, p.Marca, @FechaAlta
FROM @Productos p
INNER JOIN @Categorias k   ON k.Orden = p.Categoria
INNER JOIN dbo.Categoria c ON c.Nombre = k.Nombre
ORDER BY p.Clave;

-- Dos imágenes genéricas por producto: el nombre en los colores de la categoría y la marca en colores invertidos
INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
SELECT pr.IDProducto,
       CONCAT(N'https://placehold.co/800x800/',
              CASE n.Orden WHEN 0 THEN k.Fondo ELSE k.Texto END, N'/',
              CASE n.Orden WHEN 0 THEN k.Texto ELSE k.Fondo END,
              N'/png?font=montserrat&text=', u.Texto),
       CASE n.Orden WHEN 0 THEN p.Nombre ELSE CONCAT(p.Nombre, N' · ', p.Marca) END,
       n.Orden
FROM @Productos p
INNER JOIN dbo.Producto pr ON pr.Nombre = p.Nombre
INNER JOIN @Categorias k   ON k.Orden = p.Categoria
CROSS JOIN (VALUES (0), (1)) AS n (Orden)
CROSS APPLY (SELECT Texto = CASE n.Orden WHEN 0 THEN p.Etiqueta ELSE p.Marca END COLLATE Latin1_General_100_BIN2) t
-- Codificación para la URL; la intercalación binaria evita que 'é' se trate igual que 'e'
CROSS APPLY (SELECT Texto =
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        t.Texto, N' ', N'%20'), N'|', N'%5Cn'), N'á', N'%C3%A1'), N'é', N'%C3%A9'), N'í', N'%C3%AD'),
        N'ó', N'%C3%B3'), N'ú', N'%C3%BA'), N'ñ', N'%C3%B1'), N'"', N'%22'), N'·', N'%C2%B7')) u;

/* 3. Variantes -------------------------------------------------------------------
   PosA y PosB conservan el orden en que se escribieron los valores (S, M, L, XL). */
DECLARE @Variantes TABLE (
    Clave INT IDENTITY(1,1) PRIMARY KEY,
    IDProducto INT, SKU VARCHAR(40), Precio DECIMAL(12,2),
    AtributoA NVARCHAR(50), ValorA NVARCHAR(50), CodigoA VARCHAR(8),
    AtributoB NVARCHAR(50), ValorB NVARCHAR(50), CodigoB VARCHAR(8)
);

INSERT INTO @Variantes (IDProducto, SKU, Precio, AtributoA, ValorA, CodigoA, AtributoB, ValorB, CodigoB)
SELECT pr.IDProducto,
       CONCAT(p.Codigo, '-' + cb.Codigo, '-' + ca.Codigo),
       ISNULL(a.Precio, p.Precio),
       p.AtributoA, a.Valor, ca.Codigo,
       p.AtributoB, b.Valor, cb.Codigo
FROM @Productos p
INNER JOIN dbo.Producto pr ON pr.Nombre = p.Nombre
OUTER APPLY (
    SELECT Valor  = x.Valor,
           Precio = CASE WHEN CHARINDEX(N':', s.value) > 0 THEN TRY_CAST(SUBSTRING(s.value, CHARINDEX(N':', s.value) + 1, 20) AS DECIMAL(12,2)) END,
           Pos    = CHARINDEX(N',' + s.value + N',', N',' + p.ValoresA + N',')
    FROM STRING_SPLIT(p.ValoresA, N',') s
    CROSS APPLY (SELECT Valor = LTRIM(RTRIM(CASE WHEN CHARINDEX(N':', s.value) > 0
                                                 THEN LEFT(s.value, CHARINDEX(N':', s.value) - 1)
                                                 ELSE s.value END))) x
) a
OUTER APPLY (
    SELECT Valor = LTRIM(RTRIM(s.value)),
           Pos   = CHARINDEX(N',' + s.value + N',', N',' + p.ValoresB + N',')
    FROM STRING_SPLIT(p.ValoresB, N',') s
) b
LEFT JOIN @CodigosValor ca ON ca.Valor = a.Valor
LEFT JOIN @CodigosValor cb ON cb.Valor = b.Valor
ORDER BY p.Clave, b.Pos, a.Pos;

-- Si a un valor le faltó su código, el SKU saldría incompleto: mejor detener la carga
IF EXISTS (SELECT 1 FROM @Variantes
           WHERE (ValorA IS NOT NULL AND CodigoA IS NULL) OR (ValorB IS NOT NULL AND CodigoB IS NULL))
    THROW 50000, N'052: hay valores de atributo sin código para el SKU en @CodigosValor.', 1;

INSERT INTO dbo.Variante (IDProducto, SKU, Precio, FechaCreacion)
SELECT IDProducto, SKU, Precio, @FechaAlta FROM @Variantes ORDER BY Clave;

-- Atributos normalizados
INSERT INTO dbo.Atributo (Nombre)
SELECT AtributoA FROM @Variantes WHERE AtributoA IS NOT NULL
UNION
SELECT AtributoB FROM @Variantes WHERE AtributoB IS NOT NULL;

INSERT INTO dbo.AtributoValor (IDAtributo, Valor)
SELECT DISTINCT at.IDAtributo, x.Valor
FROM (SELECT Atributo = AtributoA, Valor = ValorA FROM @Variantes
      UNION
      SELECT AtributoB, ValorB FROM @Variantes) x
INNER JOIN dbo.Atributo at ON at.Nombre = x.Atributo
WHERE x.Valor IS NOT NULL;

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
INNER JOIN dbo.Atributo at      ON at.Nombre = v.AtributoB
INNER JOIN dbo.AtributoValor av ON av.IDAtributo = at.IDAtributo AND av.Valor = v.ValorB;

/* 4. Existencia inicial por kardex -----------------------------------------------
   Entre 25 y 79 unidades (determinístico a partir del SKU). Unas pocas variantes
   arrancan con 4 unidades para que se vea el aviso de "últimas unidades". */
DECLARE @Movimientos TABLE (IDVariante INT, Cantidad INT, Anterior INT, Nueva INT);

UPDATE x
SET x.Existencia = CASE WHEN x.SKU IN ('LUBDIE-15W40-5G', 'MOTCAI-ROJ-XL', 'ACCINF-INA', 'BEBCAF-TOS-454G') THEN 4
                        ELSE 25 + ABS(CHECKSUM(x.SKU)) % 55 END
OUTPUT inserted.IDVariante, inserted.Existencia - deleted.Existencia, deleted.Existencia, inserted.Existencia
    INTO @Movimientos (IDVariante, Cantidad, Anterior, Nueva)
FROM dbo.Variante x;

INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario, Fecha)
SELECT IDVariante, @IDTipoEntrada, Cantidad, Anterior, Nueva, N'Inventario inicial de apertura de la tienda en línea', @IDAdmin, @FechaAlta
FROM @Movimientos
ORDER BY IDVariante;

/* 5. Casos especiales -------------------------------------------------------------
   Un producto de edición limitada (muy poca existencia, lo usan los scripts de
   concurrencia de database/pruebas) y uno descontinuado. */
DECLARE @IDLimitada INT;
INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Marca, FechaCreacion)
SELECT IDCategoria, N'Playera conmemorativa edición limitada', N'Edición numerada por el aniversario de la red de estaciones; quedan muy pocas unidades.', N'ShopCart', @FechaAlta
FROM dbo.Categoria WHERE Nombre = N'Ropa y mercancía';
SET @IDLimitada = SCOPE_IDENTITY();

INSERT INTO dbo.ProductoImagen (IDProducto, Url, TextoAlternativo, Orden)
VALUES (@IDLimitada, N'https://placehold.co/800x800/1d3f9e/f5c518/png?font=montserrat&text=Edici%C3%B3n%5Cnlimitada', N'Playera conmemorativa edición limitada', 0);

INSERT INTO dbo.Variante (IDProducto, SKU, Precio, FechaCreacion)
VALUES (@IDLimitada, 'PLAQDO-NEG-M', 149.00, @FechaAlta), (@IDLimitada, 'PLAQDO-NEG-L', 149.00, @FechaAlta);

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
UPDATE dbo.Producto SET Activo = 0, FechaActualizacion = SYSUTCDATETIME() WHERE Nombre = N'Aceite monogrado SAE 40';
GO

ENABLE TRIGGER dbo.TR_Categoria_Bitacora ON dbo.Categoria;
ENABLE TRIGGER dbo.TR_Producto_Bitacora ON dbo.Producto;
ENABLE TRIGGER dbo.TR_Variante_Bitacora ON dbo.Variante;
GO
