/* =============================================================================
   Prueba 01 · Flujo de compra completo usando solo los stored procedures
   -----------------------------------------------------------------------------
   Carrito -> checkout (reserva) -> pago (pedido atómico) -> pago repetido
   (idempotencia) -> cancelación (reintegra existencia por kardex).
   Todo corre dentro de una transacción que al final se revierte, así que se
   puede ejecutar las veces que se quiera sin ensuciar los datos.
   Ejecutar en SSMS (modo SQLCMD) o con: sqlcmd ... -v DBName=ShopCart -i este_archivo
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT OFF;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE ShopCart;   -- si le pusiste otro nombre a la base, cámbialo aquí
GO

BEGIN TRANSACTION;

DECLARE @IDCliente INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'cliente@shopcart.test');
DECLARE @IDDireccion INT = (SELECT TOP (1) IDDireccion FROM dbo.Direccion WHERE IDUsuario = @IDCliente AND EsPredeterminada = 1);
DECLARE @IDEnvio INT = (SELECT IDMetodoEnvio FROM dbo.MetodoEnvio WHERE Codigo = 'ESTANDAR');
DECLARE @IDVariante INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = 'PLABAS-NEG-M');
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'admin@shopcart.test');
DECLARE @Pedido TABLE (IDPedido INT, EsDuplicado BIT);
DECLARE @IDCheckout INT, @IDPedido INT;

PRINT '1) Existencia de PLABAS-NEG-M antes de comprar:';
SELECT SKU, Existencia, Reservada, Disponible FROM dbo.Variante WHERE IDVariante = @IDVariante;

PRINT '2) Agrego 2 unidades al carrito y aplico el cupón BIENVENIDA10:';
EXEC dbo.SP_Carrito_AgregarProducto @IDUsuario = @IDCliente, @IDVariante = @IDVariante, @Cantidad = 2;
EXEC dbo.SP_Carrito_AplicarCupon @IDUsuario = @IDCliente, @Codigo = 'BIENVENIDA10';

PRINT '3) Inicio el checkout: se congelan precios y se reservan las unidades:';
EXEC dbo.SP_Checkout_Iniciar @IDUsuario = @IDCliente, @IDDireccion = @IDDireccion, @IDMetodoEnvio = @IDEnvio;
SELECT @IDCheckout = IDCheckout FROM dbo.Checkout WHERE IDUsuario = @IDCliente AND Estado = 'ACTIVO';
SELECT SKU, Existencia, Reservada, Disponible FROM dbo.Variante WHERE IDVariante = @IDVariante;

PRINT '4) Pago: se crea el pedido atómicamente';
INSERT INTO @Pedido EXEC dbo.SP_Pedidos_CrearPedido @IDUsuario = @IDCliente, @IDCheckout = @IDCheckout,
     @ClaveIdempotencia = 'prueba-flujo-0001', @CodigoAutorizacion = 'SIM-PRUEBA', @MarcaTarjeta = 'VISA', @UltimosDigitos = '1111';
SELECT @IDPedido = IDPedido FROM @Pedido;
SELECT * FROM @Pedido;
SELECT SKU, Existencia, Reservada, Disponible FROM dbo.Variante WHERE IDVariante = @IDVariante;

PRINT '5) Repito el mismo pago (doble clic): debe devolver el MISMO pedido con EsDuplicado = 1';
DELETE FROM @Pedido;
INSERT INTO @Pedido EXEC dbo.SP_Pedidos_CrearPedido @IDUsuario = @IDCliente, @IDCheckout = @IDCheckout,
     @ClaveIdempotencia = 'prueba-flujo-0001', @CodigoAutorizacion = 'SIM-PRUEBA', @MarcaTarjeta = 'VISA', @UltimosDigitos = '1111';
SELECT * FROM @Pedido;
SELECT PedidosDelCheckout = COUNT(*) FROM dbo.Pedido WHERE IDCheckout = @IDCheckout;
SELECT PagosDelPedido = COUNT(*) FROM dbo.Pago WHERE IDPedido = @IDPedido;

PRINT '6) Kardex del movimiento de venta:';
SELECT TOP (3) k.IDKardex, t.Codigo, k.Cantidad, k.ExistenciaAnterior, k.ExistenciaNueva, k.Motivo
FROM dbo.Kardex k INNER JOIN dbo.TipoMovimiento t ON t.IDTipoMovimiento = k.IDTipoMovimiento
WHERE k.IDVariante = @IDVariante ORDER BY k.IDKardex DESC;

PRINT '7) El cliente cancela: la existencia vuelve por kardex y el cupón se libera';
EXEC dbo.SP_Pedidos_Cancelar @IDUsuarioAccion = @IDCliente, @IDPedido = @IDPedido, @Motivo = N'Ya no lo necesito', @SoloPropio = 1;
SELECT SKU, Existencia, Reservada, Disponible FROM dbo.Variante WHERE IDVariante = @IDVariante;
SELECT * FROM dbo.VW_Pedidos_Historial WHERE IDPedido = @IDPedido ORDER BY Fecha;

PRINT '8) La conciliación sigue en cero:';
SELECT VariantesQueNoCuadran = COUNT(*) FROM dbo.VW_Inventario_ConciliacionKardex WHERE Cuadra = 0;

ROLLBACK TRANSACTION;
PRINT 'Listo. Todo se revirtió: la base quedó como estaba.';
GO
