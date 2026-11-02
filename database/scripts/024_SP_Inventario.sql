/* =============================================================================
   ShopCart · 024 · SPs de inventario y kardex
   -----------------------------------------------------------------------------
   Toda modificación de la existencia física pasa por el kardex. Los
   movimientos manuales (entrada por compra y ajustes) los registra el operador
   o el administrador con un motivo obligatorio. Las salidas por venta, las
   cancelaciones y las devoluciones las generan los SPs de pedidos.

   Reserva de existencia (SP_Inventario_ReservarExistencia):
   1. Bloquea las variantes del checkout con UPDLOCK y siempre en orden de
      IDVariante. Si dos checkouts comparten productos, ambos piden los bloqueos
      en el mismo orden y no se forma un deadlock.
   2. Con las filas bloqueadas revisa que alcance lo disponible. Si una sola
      línea no alcanza, falla todo el checkout (todo o nada).
   3. Si alcanza, sube Reservada. El CHECK Reservada <= Existencia de la tabla
      sería la última barrera si algo fallara arriba.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarTiposMovimiento
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDTipoMovimiento, Codigo, Nombre, Naturaleza, EsManual, RequiereMotivo
    FROM dbo.TipoMovimiento
    ORDER BY IDTipoMovimiento;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Texto          NVARCHAR(100) = NULL,
    @IDCategoria    INT           = NULL,
    @SoloBajoStock  BIT           = 0,
    @Pagina         INT           = 1,
    @TamanoPagina   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    DECLARE @Patron NVARCHAR(320) = (SELECT Patron FROM dbo.FU_Sistema_PatronBusqueda(@Texto));
    DECLARE @Umbral INT = ISNULL((SELECT Valor FROM dbo.ParametroSistema WHERE Clave = 'UMBRAL_STOCK_BAJO'), 5);

    SELECT vd.IDVariante, vd.IDProducto, vd.SKU, vd.NombreProducto, vd.DescripcionVariante, vd.IDCategoria, vd.Categoria,
           vd.Precio, vd.Existencia, vd.Reservada, vd.Disponible, vd.VarianteActiva, vd.ProductoActivo,
           BajoStock = CAST(CASE WHEN vd.Disponible <= @Umbral THEN 1 ELSE 0 END AS BIT),
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.VW_Catalogo_VarianteDetalle vd
    WHERE (@IDCategoria IS NULL OR vd.IDCategoria = @IDCategoria)
      AND (@Patron IS NULL OR vd.SKU LIKE @Patron OR vd.NombreProducto LIKE @Patron)
      AND (@SoloBajoStock = 0 OR vd.Disponible <= @Umbral)
    ORDER BY vd.Disponible ASC, vd.SKU
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

-- Entradas por compra y ajustes manuales. La cantidad llega positiva; el signo
-- lo da la naturaleza del tipo de movimiento.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDUsuarioAccion INT,
    @IDVariante      INT,
    @CodigoTipo      VARCHAR(30),
    @Cantidad        INT,
    @Motivo          NVARCHAR(250)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario @IDUsuarioAccion;

    DECLARE @IDTipo INT, @Naturaleza CHAR(1), @EsManual BIT, @Existencia INT, @Reservada INT, @SKU VARCHAR(40),
            @Delta INT, @IDKardex BIGINT, @Mensaje NVARCHAR(400);

    SELECT @IDTipo = IDTipoMovimiento, @Naturaleza = Naturaleza, @EsManual = EsManual
    FROM dbo.TipoMovimiento WHERE Codigo = @CodigoTipo;

    IF @IDTipo IS NULL OR @EsManual = 0
        THROW 53001, N'Tipo de movimiento inválido. Manualmente solo se registran entradas por compra y ajustes.', 1;
    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50001, N'La cantidad debe ser mayor a cero.', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) < 3
        THROW 53002, N'El motivo es obligatorio para cualquier movimiento manual de inventario.', 1;

    SET @Delta = CASE WHEN @Naturaleza = 'E' THEN @Cantidad ELSE -@Cantidad END;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Existencia = Existencia, @Reservada = Reservada, @SKU = SKU
        FROM dbo.Variante WITH (UPDLOCK, ROWLOCK)
        WHERE IDVariante = @IDVariante;

        IF @Existencia IS NULL
            THROW 52021, N'La variante no existe.', 1;

        IF @Existencia + @Delta < 0
        BEGIN
            SET @Mensaje = CONCAT(N'El ajuste dejaría la existencia en negativo: ', @SKU, N' tiene ', @Existencia,
                                  N' unidades y se intentan sacar ', @Cantidad, N'.');
            THROW 53003, @Mensaje, 1;
        END;
        IF @Existencia + @Delta < @Reservada
        BEGIN
            SET @Mensaje = CONCAT(N'No se puede bajar la existencia de ', @SKU, N' por debajo de las ', @Reservada,
                                  N' unidades reservadas en checkouts activos.');
            THROW 53004, @Mensaje, 1;
        END;

        UPDATE dbo.Variante
        SET Existencia = @Existencia + @Delta, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante;

        INSERT INTO dbo.Kardex (IDVariante, IDTipoMovimiento, Cantidad, ExistenciaAnterior, ExistenciaNueva, Motivo, IDUsuario)
        VALUES (@IDVariante, @IDTipo, @Delta, @Existencia, @Existencia + @Delta, LTRIM(RTRIM(@Motivo)), @IDUsuarioAccion);
        SET @IDKardex = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT k.IDKardex, k.IDVariante, v.SKU, TipoMovimiento = t.Codigo, k.Cantidad, k.ExistenciaAnterior, k.ExistenciaNueva,
           v.Reservada, v.Disponible, k.Motivo, k.Fecha
    FROM dbo.Kardex k
    INNER JOIN dbo.Variante v       ON v.IDVariante = k.IDVariante
    INNER JOIN dbo.TipoMovimiento t ON t.IDTipoMovimiento = k.IDTipoMovimiento
    WHERE k.IDKardex = @IDKardex;
END;
GO

-- Interno. Se ejecuta dentro de la transacción de SP_Checkout_Iniciar.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDCheckout INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT NOT NULL);
    DECLARE @Bloqueadas INT, @Faltantes NVARCHAR(1500), @Mensaje NVARCHAR(2000);

    INSERT INTO @Lineas (IDVariante, Cantidad)
    SELECT IDVariante, Cantidad FROM dbo.CheckoutDetalle WHERE IDCheckout = @IDCheckout;

    -- 1. Bloqueo de las variantes en orden de ID (FORCE ORDER recorre @Lineas por su PK)
    SELECT @Bloqueadas = COUNT(*)
    FROM @Lineas l
    INNER LOOP JOIN dbo.Variante v WITH (UPDLOCK, ROWLOCK) ON v.IDVariante = l.IDVariante
    OPTION (FORCE ORDER);

    -- 2. Con las filas bloqueadas, verifico que alcance para todas las líneas
    SELECT @Faltantes = STRING_AGG(CAST(CONCAT(v.SKU, N' (pediste ', l.Cantidad, N', hay ', v.Disponible, N')') AS NVARCHAR(200)), N', ')
    FROM @Lineas l
    INNER JOIN dbo.Variante v WITH (UPDLOCK, ROWLOCK) ON v.IDVariante = l.IDVariante
    WHERE v.Disponible < l.Cantidad;

    IF @Faltantes IS NOT NULL
    BEGIN
        SET @Mensaje = CONCAT(N'Ya no hay suficientes unidades disponibles: ', @Faltantes,
                              N'. Otro cliente acaba de comprarlas o reservarlas.');
        THROW 53005, @Mensaje, 1;
    END;

    -- 3. Reservo todo
    UPDATE v
    SET v.Reservada = v.Reservada + l.Cantidad
    FROM dbo.Variante v
    INNER JOIN @Lineas l ON l.IDVariante = v.IDVariante;
END;
GO

-- Libera las reservas de checkouts vencidos. Lo ejecuta un job de la API cada pocos
-- segundos, así una reserva vencida se libera sin que nadie tenga que intervenir.
-- Devuelve las variantes afectadas para avisar en tiempo real a la tienda.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReservasVencidas
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.SP_Sistema_EstablecerUsuario NULL;

    DECLARE @Vencidos TABLE (IDCheckout INT PRIMARY KEY, IDUsuario INT);
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE c
        SET c.Estado = 'EXPIRADO', c.FechaCierre = @Ahora
        OUTPUT inserted.IDCheckout, inserted.IDUsuario INTO @Vencidos (IDCheckout, IDUsuario)
        FROM dbo.Checkout c WITH (UPDLOCK, READPAST)
        WHERE c.Estado = 'ACTIVO' AND c.FechaExpiracion <= @Ahora;

        UPDATE v
        SET v.Reservada = v.Reservada - x.Cantidad
        FROM dbo.Variante v
        INNER JOIN (
            SELECT d.IDVariante, Cantidad = SUM(d.Cantidad)
            FROM dbo.CheckoutDetalle d
            INNER JOIN @Vencidos e ON e.IDCheckout = d.IDCheckout
            GROUP BY d.IDVariante
        ) x ON x.IDVariante = v.IDVariante;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    -- 1. Checkouts expirados (para avisar a cada cliente)
    SELECT IDCheckout, IDUsuario FROM @Vencidos;

    -- 2. Variantes con su nueva disponibilidad
    SELECT v.IDVariante, v.IDProducto, v.SKU, v.Existencia, v.Reservada, v.Disponible
    FROM dbo.Variante v
    WHERE v.IDVariante IN (SELECT d.IDVariante FROM dbo.CheckoutDetalle d INNER JOIN @Vencidos e ON e.IDCheckout = d.IDCheckout);
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarKardex
    @IDVariante     INT          = NULL,
    @CodigoTipo     VARCHAR(30)  = NULL,
    @Desde          DATETIME2(3) = NULL,
    @Hasta          DATETIME2(3) = NULL,
    @Pagina         INT          = 1,
    @TamanoPagina   INT          = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;
    IF @IDVariante IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 52021, N'La variante no existe.', 1;

    SELECT k.IDKardex, k.IDVariante, v.SKU, NombreProducto = p.Nombre,
           TipoMovimiento = t.Codigo, NombreTipo = t.Nombre, t.Naturaleza,
           k.Cantidad, k.ExistenciaAnterior, k.ExistenciaNueva, k.Motivo,
           k.IDPedido, NumeroPedido = pe.NumeroPedido, k.IDDevolucion,
           k.IDUsuario, Usuario = CASE WHEN u.IDUsuario IS NULL THEN N'Sistema' ELSE CONCAT(u.Nombres, N' ', u.Apellidos) END,
           k.Fecha,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.Kardex k
    INNER JOIN dbo.Variante v       ON v.IDVariante = k.IDVariante
    INNER JOIN dbo.Producto p       ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.TipoMovimiento t ON t.IDTipoMovimiento = k.IDTipoMovimiento
    LEFT JOIN dbo.Pedido pe         ON pe.IDPedido = k.IDPedido
    LEFT JOIN dbo.Usuario u         ON u.IDUsuario = k.IDUsuario
    WHERE (@IDVariante IS NULL OR k.IDVariante = @IDVariante)
      AND (@CodigoTipo IS NULL OR t.Codigo = @CodigoTipo)
      AND (@Desde IS NULL OR k.Fecha >= @Desde)
      AND (@Hasta IS NULL OR k.Fecha < @Hasta)
    ORDER BY k.Fecha DESC, k.IDKardex DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

-- Comprueba que la existencia de cada variante sea igual a la suma de su kardex
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Conciliacion
    @SoloDiferencias BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        VariantesRevisadas  = COUNT(*),
        VariantesConError   = SUM(CASE WHEN Cuadra = 0 THEN 1 ELSE 0 END),
        TotalExistencia     = SUM(Existencia),
        TotalKardex         = SUM(SumaKardex)
    FROM dbo.VW_Inventario_ConciliacionKardex;

    SELECT IDVariante, SKU, Existencia, SumaKardex, Diferencia, Movimientos, SaldoUltimoMovimiento, Cuadra
    FROM dbo.VW_Inventario_ConciliacionKardex
    WHERE @SoloDiferencias = 0 OR Cuadra = 0
    ORDER BY SKU;
END;
GO
