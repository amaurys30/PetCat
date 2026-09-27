-- ═══════════════════════════════════════════════════════════════════════════
--  PetCat — Datos de desarrollo
--  Se ejecuta sobre una base recién creada con database/petcat.sql.
--  Contraseña de todos los usuarios: Petcat123!
--
--  Usuarios:
--    admin@petcat.test           Super admin de la plataforma
--    propietario@petcat.test     Dueño de "Clínica Veterinaria Patitas" (plan Gratuito)
--    veterinario@petcat.test     Empleado vinculado con rol Veterinario
--    cliente@petcat.test         Dueño de mascotas (Max y Luna)
--  Empleado sin cuenta:
--    recepcionista@petcat.test   Rol Recepcionista, con invitación pendiente.
--      Enlace: http://localhost:5173/invitacion/5eed000000000000000000000000000000000000000000000000000000000001
--      (en la base se guarda el SHA-256 del token, como en producción)
-- ═══════════════════════════════════════════════════════════════════════════

-- El cliente mysql de docker compose (volumen nuevo) usa latin1 por defecto: sin esta
-- línea, el texto con tildes queda codificado dos veces ("Vacunación" -> "VacunaciÃ³n").
SET NAMES utf8mb4;

USE petcat_db;

SET @password_hash = '$2b$10$HAfHOvaNuKTYLvz9ZclTruccGGuIo.RgjWjcBIoOQ2zQfRNqdqQIG';

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
VALUES ('Admin', 'PetCat', 'admin@petcat.test', @password_hash, '3000000000', 'admin', TRUE);

INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
VALUES ('Laura', 'Martínez', 'propietario@petcat.test', @password_hash, '3001112233', 'negocio', TRUE);
SET @id_propietario = LAST_INSERT_ID();

INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
VALUES ('Carlos', 'Pérez', 'veterinario@petcat.test', @password_hash, '3002223344', 'cliente', TRUE);
SET @id_usuario_vet = LAST_INSERT_ID();

INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
VALUES ('Sofía', 'Gómez', 'cliente@petcat.test', @password_hash, '3003334455', 'cliente', TRUE);
SET @id_cliente = LAST_INSERT_ID();

-- Toda cuenta registra su autorización de tratamiento de datos (versión vigente de la política).
INSERT INTO autorizaciones_datos (id_usuario, canal, id_usuario_registro, version_politica)
SELECT id_usuario, 'app', id_usuario, (SELECT valor FROM configuracion_global WHERE clave = 'terminos_version')
FROM usuarios
WHERE email IN ('admin@petcat.test', 'propietario@petcat.test', 'veterinario@petcat.test', 'cliente@petcat.test');

-- ---------------------------------------------------------------------------
-- Negocio con suscripción Gratuita (sin vencimiento)
-- ---------------------------------------------------------------------------
INSERT INTO negocios (id_usuario_propietario, nombre, tipo, descripcion, telefono, whatsapp, email,
                      direccion, ciudad, latitud, longitud, verificado)
VALUES (@id_propietario, 'Clínica Veterinaria Patitas', 'veterinaria',
        'Consulta general, vacunación y peluquería para perros y gatos.',
        '6052801010', '3001112233', 'contacto@patitas.test',
        'Calle 23 # 18-45, Centro', 'Sincelejo', 9.30472000, -75.39778000, TRUE);
SET @id_negocio = LAST_INSERT_ID();

INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin)
VALUES (@id_negocio, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Gratuito'),
        'mensual', 'activa', CURDATE(), '9999-12-31');

-- ---------------------------------------------------------------------------
-- Sucursal principal y horarios (0 = domingo ... 6 = sábado)
-- Horario partido de lunes a viernes; sábado solo en la mañana; domingo cerrado.
-- ---------------------------------------------------------------------------
INSERT INTO sucursales (id_negocio, nombre, telefono, direccion, ciudad, latitud, longitud, es_principal)
VALUES (@id_negocio, 'Sede Centro', '6052801010', 'Calle 23 # 18-45, Centro', 'Sincelejo',
        9.30472000, -75.39778000, TRUE);
SET @id_sucursal = LAST_INSERT_ID();

INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre) VALUES
(@id_sucursal, 1, '08:00:00', '12:00:00'), (@id_sucursal, 1, '14:00:00', '18:00:00'),
(@id_sucursal, 2, '08:00:00', '12:00:00'), (@id_sucursal, 2, '14:00:00', '18:00:00'),
(@id_sucursal, 3, '08:00:00', '12:00:00'), (@id_sucursal, 3, '14:00:00', '18:00:00'),
(@id_sucursal, 4, '08:00:00', '12:00:00'), (@id_sucursal, 4, '14:00:00', '18:00:00'),
(@id_sucursal, 5, '08:00:00', '12:00:00'), (@id_sucursal, 5, '14:00:00', '18:00:00'),
(@id_sucursal, 6, '08:00:00', '12:00:00');

-- ---------------------------------------------------------------------------
-- Empleados: veterinario vinculado y recepcionista con invitación pendiente
-- ---------------------------------------------------------------------------
INSERT INTO empleados (id_negocio, id_rol, id_usuario, nombre, apellido, email, telefono,
                       especialidad, titulo_profesional, registro_profesional, fecha_vinculacion)
VALUES (@id_negocio,
        (SELECT id_rol FROM roles WHERE nombre = 'Veterinario' AND es_sistema = TRUE),
        @id_usuario_vet, 'Carlos', 'Pérez', 'veterinario@petcat.test', '3002223344',
        'Medicina de pequeños animales', 'Médico Veterinario Zootecnista', 'MVZ-12345', CURDATE());
SET @id_veterinario = LAST_INSERT_ID();

INSERT INTO empleados (id_negocio, id_rol, nombre, apellido, email, telefono, fecha_vinculacion)
VALUES (@id_negocio,
        (SELECT id_rol FROM roles WHERE nombre = 'Recepcionista' AND es_sistema = TRUE),
        'Ana', 'Rodríguez', 'recepcionista@petcat.test', '3004445566', CURDATE());
SET @id_recepcionista = LAST_INSERT_ID();

INSERT INTO invitaciones_empleado (id_empleado, id_negocio, email, token, expiracion)
VALUES (@id_recepcionista, @id_negocio, 'recepcionista@petcat.test',
        '6a953f5e1628ea9de6edd59018457b8efe32238d438801eb3465439a0e2531fd',
        DATE_ADD(NOW(), INTERVAL 30 DAY));

-- ---------------------------------------------------------------------------
-- Cliente con dos mascotas
-- ---------------------------------------------------------------------------
INSERT INTO mascotas (id_usuario, nombre, especie, raza, color, fecha_nacimiento, sexo, peso, esterilizado)
VALUES (@id_cliente, 'Max', 'perro', 'Labrador', 'Dorado', '2021-03-15', 'macho', 28.50, TRUE),
       (@id_cliente, 'Luna', 'gato', 'Criolla', 'Gris', '2023-07-01', 'hembra', 3.80, FALSE);

-- ---------------------------------------------------------------------------
-- Servicios del negocio
-- ---------------------------------------------------------------------------
INSERT INTO servicios (id_negocio, id_categoria, nombre, descripcion, precio_base, duracion_minutos, tipo_mascota)
VALUES
(@id_negocio, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Consulta y diagnóstico'),
 'Consulta general', 'Revisión completa, diagnóstico y fórmula médica.', 60000.00, 30, 'perro,gato'),
(@id_negocio, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Vacunación'),
 'Vacuna antirrábica', 'Aplicación de vacuna antirrábica con registro en el carnet.', 45000.00, 15, 'perro,gato'),
(@id_negocio, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Baño y estética'),
 'Baño y corte', 'Baño con champú hipoalergénico, corte de uñas y limpieza de oídos.', 55000.00, 60, 'perro');

-- El veterinario atiende la consulta y la vacuna. "Baño y corte" queda sin
-- empleados asignados: el panel lo muestra con sin_empleados y la app como no reservable.
INSERT INTO empleado_servicios (id_empleado, id_servicio)
SELECT @id_veterinario, id_servicio
FROM servicios
WHERE id_negocio = @id_negocio AND nombre IN ('Consulta general', 'Vacuna antirrábica');
