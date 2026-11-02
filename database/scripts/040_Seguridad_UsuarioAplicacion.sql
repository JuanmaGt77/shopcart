/* =============================================================================
   ShopCart · 040 · Usuario de la aplicación (mínimo privilegio)
   -----------------------------------------------------------------------------
   La API no se conecta con sa. Usa un login propio cuyo rol en la base:
   - Puede EJECUTAR los stored procedures del esquema dbo.
   - NO puede leer ni escribir tablas o vistas directamente (DENY explícito).
     Los SPs sí pueden porque tienen el mismo dueño que las tablas (ownership
     chaining): el permiso se revisa al ejecutar el SP, no en cada tabla.
   - NO puede ejecutar los SPs internos (los que solo llaman otros SPs).

   Resultado: aunque alguien lograra mandar SQL arbitrario por la conexión de la
   API, no podría hacer un SELECT a Usuario ni un DELETE a Bitacora.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(AppUser)')
    CREATE LOGIN [$(AppUser)] WITH PASSWORD = N'$(AppPassword)', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN [$(AppUser)] WITH PASSWORD = N'$(AppPassword)';
GO

USE [$(DBName)];
GO

IF DATABASE_PRINCIPAL_ID(N'$(AppUser)') IS NULL
    CREATE USER [$(AppUser)] FOR LOGIN [$(AppUser)];
GO

IF DATABASE_PRINCIPAL_ID(N'RolAplicacion') IS NULL
    CREATE ROLE RolAplicacion;
GO

ALTER ROLE RolAplicacion ADD MEMBER [$(AppUser)];
GO

-- Solo ejecutar procedimientos
GRANT EXECUTE ON SCHEMA::dbo TO RolAplicacion;

-- Ningún acceso directo a los datos
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO RolAplicacion;

-- Los tipos tabla que reciben los SPs
GRANT EXECUTE ON TYPE::dbo.TT_Catalogo_Variante TO RolAplicacion;
GRANT EXECUTE ON TYPE::dbo.TT_Catalogo_AtributoVariante TO RolAplicacion;
GRANT EXECUTE ON TYPE::dbo.TT_Catalogo_Imagen TO RolAplicacion;
GRANT EXECUTE ON TYPE::dbo.TT_Devoluciones_Linea TO RolAplicacion;

-- SPs internos: solo los pueden llamar otros SPs
DENY EXECUTE ON OBJECT::dbo.SP_Sistema_EstablecerUsuario TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Carrito_ResolverCarrito TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Carrito_ConsultarPorID TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Checkout_CancelarActivoDeCarrito TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Checkout_ConsultarPorID TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Inventario_ReservarExistencia TO RolAplicacion;
DENY EXECUTE ON OBJECT::dbo.SP_Pedidos_ConsultarPorID TO RolAplicacion;
GO
