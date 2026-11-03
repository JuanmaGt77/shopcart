/* =============================================================================
   Prueba 04 · Dos clientes intentan comprar la última unidad (manual, SSMS)
   -----------------------------------------------------------------------------
   Esta prueba necesita DOS ventanas de consulta para simular dos personas a la
   vez. (Hay una versión automática con 20 clientes en paralelo:
   `npm run demo:concurrencia` desde backend/.)

   PREPARACIÓN (cualquier ventana): deja la variante con 1 sola unidad disponible
   y pone la misma variante en el carrito de dos clientes.
   ============================================================================= */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE ShopCart;   -- si le pusiste otro nombre a la base, cámbialo aquí
GO
/* ---- PREPARACIÓN ---------------------------------------------------------- */
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'admin@shopcart.test');
DECLARE @IDVariante INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = 'PLAQDO-NEG-L');
DECLARE @Sobra INT = (SELECT Disponible - 1 FROM dbo.Variante WHERE IDVariante = @IDVariante);
IF @Sobra > 0
    EXEC dbo.SP_Inventario_RegistrarMovimiento @IDAdmin, @IDVariante, 'AJUSTE_SALIDA', @Sobra, N'Preparación de la prueba de concurrencia';

DECLARE @A INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'maria.lopez@shopcart.test');
DECLARE @B INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'jc.perez@shopcart.test');
EXEC dbo.SP_Carrito_Vaciar @IDUsuario = @A;
EXEC dbo.SP_Carrito_Vaciar @IDUsuario = @B;
EXEC dbo.SP_Carrito_AgregarProducto @IDUsuario = @A, @IDVariante = @IDVariante, @Cantidad = 1;
EXEC dbo.SP_Carrito_AgregarProducto @IDUsuario = @B, @IDVariante = @IDVariante, @Cantidad = 1;
SELECT SKU, Existencia, Reservada, Disponible FROM dbo.Variante WHERE IDVariante = @IDVariante;
GO

/* ---- VENTANA 1 (cliente A) ------------------------------------------------
   Abre la transacción y NO la cierres todavía: el UPDLOCK queda tomado.

BEGIN TRANSACTION;
DECLARE @A INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'maria.lopez@shopcart.test');
DECLARE @DirA INT = (SELECT TOP 1 IDDireccion FROM dbo.Direccion WHERE IDUsuario = @A AND EsPredeterminada = 1);
EXEC dbo.SP_Checkout_Iniciar @IDUsuario = @A, @IDDireccion = @DirA, @IDMetodoEnvio = 1;
-- (todavía no ejecutes el COMMIT)
*/

/* ---- VENTANA 2 (cliente B) ------------------------------------------------
   Ejecuta esto mientras la ventana 1 sigue abierta: se queda ESPERANDO.

DECLARE @B INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'jc.perez@shopcart.test');
DECLARE @DirB INT = (SELECT TOP 1 IDDireccion FROM dbo.Direccion WHERE IDUsuario = @B AND EsPredeterminada = 1);
EXEC dbo.SP_Checkout_Iniciar @IDUsuario = @B, @IDDireccion = @DirB, @IDMetodoEnvio = 1;
*/

/* ---- VENTANA 1 ------------------------------------------------------------
COMMIT TRANSACTION;
   En cuanto confirmas, la ventana 2 continúa y recibe:
   "Ya no hay suficientes unidades disponibles: PLAQDO-NEG-L (pediste 1, hay 0)..."
   Solo uno de los dos logró reservar. Nunca hay sobreventa.
*/
