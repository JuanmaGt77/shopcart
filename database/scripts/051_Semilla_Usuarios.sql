/* =============================================================================
   ShopCart · 051 · Datos semilla: usuarios y direcciones
   -----------------------------------------------------------------------------
   Credenciales de prueba (también están en el README):
     admin@shopcart.test     Admin123!     (Administrador)
     operador@shopcart.test  Operador123!  (Operador)
     cliente@shopcart.test   Cliente123!   (Cliente con pedidos de ejemplo)
     El resto de clientes usa la misma clave Cliente123!.
   Los hashes son argon2id (m=19456, t=2, p=1) generados con la misma librería
   que usa la API. Uso el dominio .test porque está reservado para pruebas.
   Los triggers de bitácora se apagan mientras se cargan las semillas para que
   la bitácora solo muestre actividad real del sistema.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE [$(DBName)];
GO

DISABLE TRIGGER dbo.TR_Usuario_Bitacora ON dbo.Usuario;
GO

DECLARE @HashAdmin    VARCHAR(255) = '$argon2id$v=19$m=19456,t=2,p=1$AJ3050jSGPaH+HQ3EtD03g$7EaDvH7vyogTRJuYeT4+esMDl/RC26JsVukhNk5oAJw';
DECLARE @HashOperador VARCHAR(255) = '$argon2id$v=19$m=19456,t=2,p=1$dt6P/SLR80ZtIsbzAvuYOQ$KO60kgyc3gz8ujlofNIjL8zu1lxS30aw1v6n04LP8MY';
DECLARE @HashCliente  VARCHAR(255) = '$argon2id$v=19$m=19456,t=2,p=1$F7lEIPdEnJ6IK/68y2IkNQ$4R78yeZ5qOaFtIbXBxESAhM4+6wAx27hjNeikh+lvCw';
DECLARE @Inicio DATETIME2(3) = DATEADD(DAY, -120, SYSUTCDATETIME());

INSERT INTO dbo.Usuario (IDRol, Correo, HashContrasena, Nombres, Apellidos, Telefono, FechaCreacion)
SELECT r.IDRol, u.Correo, u.Hash, u.Nombres, u.Apellidos, u.Telefono, DATEADD(DAY, u.DiaAlta, @Inicio)
FROM (VALUES
    ( 1, 'ADMIN',    N'admin@shopcart.test',              @HashAdmin,    N'Andrea',       N'Morales Castillo', '5550-1001', 0),
    ( 2, 'OPERADOR', N'operador@shopcart.test',           @HashOperador, N'Luis Fernando', N'Hernández',       '5550-1002', 0),
    ( 3, 'OPERADOR', N'bodega@shopcart.test',             @HashOperador, N'Kevin',        N'Monterroso',       '5550-1003', 5),
    ( 4, 'CLIENTE',  N'cliente@shopcart.test',            @HashCliente,  N'Juan Manuel',  N'García',           '5512-3344', 2),
    ( 5, 'CLIENTE',  N'maria.lopez@shopcart.test',        @HashCliente,  N'María José',   N'López',            '4123-8890', 3),
    ( 6, 'CLIENTE',  N'jc.perez@shopcart.test',           @HashCliente,  N'Juan Carlos',  N'Pérez',            '5876-2210', 4),
    ( 7, 'CLIENTE',  N'ana.morales@shopcart.test',        @HashCliente,  N'Ana Lucía',    N'Morales',          '3011-4567', 6),
    ( 8, 'CLIENTE',  N'jose.garcia@shopcart.test',        @HashCliente,  N'José Antonio', N'García',           '5432-1098', 8),
    ( 9, 'CLIENTE',  N'andrea.castillo@shopcart.test',    @HashCliente,  N'Andrea',       N'Castillo',         '4789-0012', 10),
    (10, 'CLIENTE',  N'sofia.rodriguez@shopcart.test',    @HashCliente,  N'Sofía',        N'Rodríguez',        '5221-7788', 12),
    (11, 'CLIENTE',  N'diego.mendez@shopcart.test',       @HashCliente,  N'Diego Alejandro', N'Méndez',        '3345-9087', 15),
    (12, 'CLIENTE',  N'gabriela.ramirez@shopcart.test',   @HashCliente,  N'Gabriela',     N'Ramírez',          '5698-3321', 18),
    (13, 'CLIENTE',  N'carlos.ortiz@shopcart.test',       @HashCliente,  N'Carlos Enrique', N'Ortiz',          '4456-1209', 20),
    (14, 'CLIENTE',  N'valeria.cifuentes@shopcart.test',  @HashCliente,  N'Valeria',      N'Cifuentes',        '5011-6543', 23),
    (15, 'CLIENTE',  N'pablo.estrada@shopcart.test',      @HashCliente,  N'Pablo',        N'Estrada',          '3198-7765', 26),
    (16, 'CLIENTE',  N'daniela.barrios@shopcart.test',    @HashCliente,  N'Daniela',      N'Barrios',          '5567-4432', 30),
    (17, 'CLIENTE',  N'fernando.juarez@shopcart.test',    @HashCliente,  N'Fernando',     N'Juárez',           '4210-9988', 34),
    (18, 'CLIENTE',  N'mariana.galvez@shopcart.test',     @HashCliente,  N'Mariana',      N'Gálvez',           '5789-1122', 38),
    (19, 'CLIENTE',  N'lucia.aguilar@shopcart.test',      @HashCliente,  N'Lucía',        N'Aguilar',          '3301-2244', 41),
    (20, 'CLIENTE',  N'ricardo.velasquez@shopcart.test',  @HashCliente,  N'Ricardo',      N'Velásquez',        '5123-6677', 45),
    (21, 'CLIENTE',  N'paola.recinos@shopcart.test',      @HashCliente,  N'Paola',        N'Recinos',          '4987-3355', 50),
    (22, 'CLIENTE',  N'alejandro.sandoval@shopcart.test', @HashCliente,  N'Alejandro',    N'Sandoval',         '5345-8800', 55),
    (23, 'CLIENTE',  N'karla.orellana@shopcart.test',     @HashCliente,  N'Karla',        N'Orellana',         '3056-7711', 61),
    (24, 'CLIENTE',  N'mario.cabrera@shopcart.test',      @HashCliente,  N'Mario',        N'Cabrera',          '5632-0099', 70)
) AS u (Orden, Rol, Correo, Hash, Nombres, Apellidos, Telefono, DiaAlta)
INNER JOIN dbo.Rol r ON r.Codigo = u.Rol
ORDER BY u.Orden;  -- así el administrador queda con el ID 1
GO

-- Una dirección predeterminada por cliente (y una segunda para el cliente de prueba)
INSERT INTO dbo.Direccion (IDUsuario, IDDepartamento, Alias, NombreDestinatario, Telefono, Linea1, Linea2, Zona,
                           Municipio, CodigoPostal, Referencia, EsPredeterminada, FechaCreacion)
SELECT u.IDUsuario, dep.IDDepartamento, d.Alias, CONCAT(u.Nombres, N' ', u.Apellidos), u.Telefono, d.Linea1, d.Linea2,
       d.Zona, d.Municipio, d.CodigoPostal, d.Referencia, d.Predeterminada, u.FechaCreacion
FROM (VALUES
    (N'cliente@shopcart.test',            N'Casa',    N'6a. avenida 12-45',            N'Apto. 302',      10, N'Guatemala',          N'Guatemala',      '01010', N'Edificio gris frente al parque', 1),
    (N'cliente@shopcart.test',            N'Oficina', N'Diagonal 6, 10-01',            N'Torre II, nivel 8', 10, N'Guatemala',       N'Guatemala',      '01010', NULL, 0),
    (N'maria.lopez@shopcart.test',        N'Casa',    N'Calzada Roosevelt 22-43',      NULL,              11, N'Guatemala',          N'Guatemala',      '01011', N'Casa esquinera portón negro', 1),
    (N'jc.perez@shopcart.test',           N'Casa',    N'3a. calle 4-20',               N'Colonia El Naranjo', 4, N'Mixco',           N'Guatemala',      '01057', NULL, 1),
    (N'ana.morales@shopcart.test',        N'Casa',    N'Calle del Arco 15',            NULL,              NULL, N'Antigua Guatemala', N'Sacatepéquez', '03001', N'A dos cuadras del Arco de Santa Catalina', 1),
    (N'jose.garcia@shopcart.test',        N'Casa',    N'14 avenida 5-67',              N'Zona 3',         NULL, N'Quetzaltenango',    N'Quetzaltenango', '09001', NULL, 1),
    (N'andrea.castillo@shopcart.test',    N'Casa',    N'Boulevard Los Próceres 18-01', NULL,              10, N'Guatemala',          N'Guatemala',      '01010', NULL, 1),
    (N'sofia.rodriguez@shopcart.test',    N'Casa',    N'Residenciales Villa Hermosa, casa 14', NULL,      7,  N'Villa Nueva',        N'Guatemala',      '01064', N'Garita principal', 1),
    (N'diego.mendez@shopcart.test',       N'Casa',    N'Barrio El Centro, 2a. calle',  NULL,              NULL, N'Cobán',             N'Alta Verapaz',   '16001', NULL, 1),
    (N'gabriela.ramirez@shopcart.test',   N'Casa',    N'Avenida Las Américas 9-50',    NULL,              13, N'Guatemala',          N'Guatemala',      '01013', NULL, 1),
    (N'carlos.ortiz@shopcart.test',       N'Casa',    N'1a. avenida 3-15',             NULL,              NULL, N'Escuintla',         N'Escuintla',      '05001', NULL, 1),
    (N'valeria.cifuentes@shopcart.test',  N'Casa',    N'Calle principal, lote 8',      N'Aldea El Remate', NULL, N'Flores',           N'Petén',          '17001', N'Frente al lago', 1),
    (N'pablo.estrada@shopcart.test',      N'Casa',    N'5a. avenida 8-33',             NULL,              1,  N'Guatemala',          N'Guatemala',      '01001', NULL, 1),
    (N'daniela.barrios@shopcart.test',    N'Casa',    N'Km 15 carretera a El Salvador', N'Condominio Vistas, casa 22', NULL, N'Santa Catarina Pinula', N'Guatemala', '01051', NULL, 1),
    (N'fernando.juarez@shopcart.test',    N'Casa',    N'Barrio San Antonio, 4a. calle', NULL,             NULL, N'Chiquimula',        N'Chiquimula',     '20001', NULL, 1),
    (N'mariana.galvez@shopcart.test',     N'Casa',    N'Avenida Petapa 34-80',         NULL,              12, N'Guatemala',          N'Guatemala',      '01012', NULL, 1),
    (N'lucia.aguilar@shopcart.test',      N'Casa',    N'Calle Santander',              NULL,              NULL, N'Panajachel',        N'Sololá',         '07010', N'Cerca del embarcadero', 1),
    (N'ricardo.velasquez@shopcart.test',  N'Casa',    N'8a. calle 2-14',               NULL,              NULL, N'Puerto Barrios',    N'Izabal',         '18001', NULL, 1),
    (N'paola.recinos@shopcart.test',      N'Casa',    N'Colonia Molino de las Flores, casa 9', NULL,      2,  N'Mixco',              N'Guatemala',      '01057', NULL, 1),
    (N'alejandro.sandoval@shopcart.test', N'Casa',    N'20 calle 15-35',               NULL,              15, N'Guatemala',          N'Guatemala',      '01015', NULL, 1),
    (N'karla.orellana@shopcart.test',     N'Casa',    N'Barrio La Reforma, 6a. avenida', NULL,            NULL, N'Zacapa',            N'Zacapa',         '19001', NULL, 1),
    (N'mario.cabrera@shopcart.test',      N'Casa',    N'4a. calle 9-12',               NULL,              NULL, N'Huehuetenango',     N'Huehuetenango',  '13001', NULL, 1)
) AS d (Correo, Alias, Linea1, Linea2, Zona, Municipio, Departamento, CodigoPostal, Referencia, Predeterminada)
INNER JOIN dbo.Usuario u       ON u.Correo = d.Correo
INNER JOIN dbo.Departamento dep ON dep.Nombre = d.Departamento;
GO

ENABLE TRIGGER dbo.TR_Usuario_Bitacora ON dbo.Usuario;
GO
