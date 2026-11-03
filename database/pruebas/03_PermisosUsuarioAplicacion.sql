/* =============================================================================
   Prueba 03 · El usuario de la API solo puede ejecutar stored procedures
   -----------------------------------------------------------------------------
   Ejecutar con un usuario administrador. Se suplanta al usuario de la
   aplicación con EXECUTE AS y se prueba qué puede y qué no puede hacer.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE ShopCart;   -- si le pusiste otro nombre a la base, cámbialo aquí
GO

EXECUTE AS USER = N'shopcart_app';
PRINT CONCAT('Ahora soy: ', USER_NAME());

PRINT '--- 1. Ejecutar un SP público: permitido';
EXEC dbo.SP_Sistema_Salud;

PRINT '--- 2. Leer una tabla directamente: denegado';
BEGIN TRY
    SELECT TOP (1) Correo, HashContrasena FROM dbo.Usuario;
END TRY
BEGIN CATCH
    PRINT CONCAT('Denegado (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 3. Borrar la bitácora directamente: denegado';
BEGIN TRY
    DELETE FROM dbo.Bitacora;
END TRY
BEGIN CATCH
    PRINT CONCAT('Denegado (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

PRINT '--- 4. Ejecutar un SP interno: denegado';
BEGIN TRY
    EXEC dbo.SP_Pedidos_ConsultarPorID @IDPedido = 1;
END TRY
BEGIN CATCH
    PRINT CONCAT('Denegado (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
END CATCH;

REVERT;
PRINT CONCAT('De vuelta como: ', USER_NAME());
GO
