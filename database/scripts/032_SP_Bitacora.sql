/* =============================================================================
   ShopCart · 032 · SPs de bitácora (solo lectura, solo Administrador)
   -----------------------------------------------------------------------------
   No existe ningún SP para modificar o borrar la bitácora. Además la tabla tiene
   un trigger que lo impide y el usuario de la aplicación no tiene permisos
   directos sobre ella.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Listar
    @Modulo         VARCHAR(20)  = NULL,
    @Entidad        VARCHAR(40)  = NULL,
    @IDEntidad      VARCHAR(40)  = NULL,
    @Accion         VARCHAR(20)  = NULL,
    @IDUsuario      INT          = NULL,
    @Desde          DATETIME2(3) = NULL,
    @Hasta          DATETIME2(3) = NULL,
    @Pagina         INT          = 1,
    @TamanoPagina   INT          = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 OR @TamanoPagina NOT BETWEEN 1 AND 100
        THROW 50001, N'Paginación inválida: la página empieza en 1 y el tamaño va de 1 a 100.', 1;

    SELECT b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion, b.ValorAnterior, b.ValorNuevo,
           b.IDUsuario,
           Usuario = CASE WHEN u.IDUsuario IS NULL THEN N'Sistema' ELSE CONCAT(u.Nombres, N' ', u.Apellidos) END,
           CorreoUsuario = u.Correo,
           b.UsuarioBD, b.Fecha,
           TotalRegistros = COUNT(*) OVER ()
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@Accion IS NULL OR b.Accion = @Accion)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@Desde IS NULL OR b.Fecha >= @Desde)
      AND (@Hasta IS NULL OR b.Fecha < @Hasta)
    ORDER BY b.Fecha DESC, b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_ResumenModulos
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Modulo, Registros = COUNT(*), UltimoRegistro = MAX(Fecha)
    FROM dbo.Bitacora
    GROUP BY Modulo
    ORDER BY Modulo;
END;
GO
