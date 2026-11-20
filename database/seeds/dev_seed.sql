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
--    huellitas@petcat.test       Dueño de "Peluquería Canina Huellitas"
--    guarderia@petcat.test       Dueña de "Guardería Patas Felices"
--    saludanimal@petcat.test     Dueño de "Centro Veterinario Salud Animal 24h" (plan Pro en prueba)
--    vet.salud@petcat.test       Veterinaria de Salud Animal y recepcionista de Huellitas (dos negocios)
--    camilo@petcat.test          Dueño de Rocky (no comparte historial) y Mía
--    valeria@petcat.test         Dueña de Copito y Nala (fallecida)
--    jorge@petcat.test           Cliente sin app registrado desde el panel (Toby)
--    andrea@, luis@, marta@petcat.test  Clientes sin app de la guardería (Fase 2)
--    lorena@petcat.test          Clienta de Patitas con la app (Milo y Nina)
--    pedro@petcat.test           Cliente sin app registrado desde el panel de Patitas (Lucas)
--  El detalle de lo que hay en cada negocio está en backend/README.md (Seed de desarrollo).
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

-- ═══════════════════════════════════════════════════════════════════════════
--  Datos para diseñar con casos realistas
--  Las fechas son relativas a CURDATE(), así que el seed sigue vigente el día que
--  se cargue. Las citas futuras caen en días en que abre su sucursal.
-- ═══════════════════════════════════════════════════════════════════════════

-- Días futuros de lunes a sábado (un domingo pasa al lunes).
-- (Cada fecha se calcula en una sola expresión: una variable de usuario guarda la
-- fecha como texto y reutilizarla mezcla collations.)
SET @f2 = CURDATE() + INTERVAL (2 + (DAYOFWEEK(CURDATE() + INTERVAL 2 DAY) = 1)) DAY;
SET @f3 = CURDATE() + INTERVAL (3 + (DAYOFWEEK(CURDATE() + INTERVAL 3 DAY) = 1)) DAY;
SET @f5 = CURDATE() + INTERVAL (5 + (DAYOFWEEK(CURDATE() + INTERVAL 5 DAY) = 1)) DAY;
SET @f7 = CURDATE() + INTERVAL (7 + (DAYOFWEEK(CURDATE() + INTERVAL 7 DAY) = 1)) DAY;
SET @f9 = CURDATE() + INTERVAL (9 + (DAYOFWEEK(CURDATE() + INTERVAL 9 DAY) = 1)) DAY;
-- Día hábil (lunes a viernes) para la guardería.
SET @f4_habil = CURDATE() + INTERVAL (4 + CASE DAYOFWEEK(CURDATE() + INTERVAL 4 DAY) WHEN 7 THEN 2 WHEN 1 THEN 1 ELSE 0 END) DAY;
-- Próximo sábado (spa felino) y próximo domingo (jornada de vacunación).
SET @sabado = CURDATE() + INTERVAL IF(DAYOFWEEK(CURDATE()) = 7, 7, 7 - DAYOFWEEK(CURDATE())) DAY;
SET @domingo = CURDATE() + INTERVAL (8 - DAYOFWEEK(CURDATE())) DAY;
-- Vacaciones de la veterinaria de Salud Animal y una cita que queda dentro de ellas.
SET @vac_desde = CURDATE() + INTERVAL 20 DAY;
SET @vac_hasta = CURDATE() + INTERVAL 26 DAY;
SET @f22 = CURDATE() + INTERVAL 22 DAY;
SET @version = (SELECT valor FROM configuracion_global WHERE clave = 'terminos_version');

-- ---------------------------------------------------------------------------
-- Usuarios nuevos
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado, ultimo_acceso) VALUES
('Julián',    'Rincón',  'huellitas@petcat.test',   @password_hash, '3005550101', 'negocio', TRUE,  NOW()),
('Natalia',   'Castro',  'guarderia@petcat.test',   @password_hash, '3005550202', 'negocio', TRUE,  NOW()),
('Ricardo',   'Mendoza', 'saludanimal@petcat.test', @password_hash, '3005550303', 'negocio', TRUE,  NOW()),
('Valentina', 'Ruiz',    'vet.salud@petcat.test',   @password_hash, '3005550404', 'cliente', TRUE,  NOW()),
('Camilo',    'Torres',  'camilo@petcat.test',      @password_hash, '3006660101', 'cliente', TRUE,  NOW()),
('Valeria',   'Ortiz',   'valeria@petcat.test',     @password_hash, '3006660202', 'cliente', FALSE, NOW());
-- Cliente sin app: lo registró Salud Animal desde el panel y nunca ha iniciado sesión.
INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
VALUES ('Jorge', 'Salcedo', 'jorge@petcat.test', @password_hash, '300 777 0101', 'cliente', FALSE);

SET @u_huellitas = (SELECT id_usuario FROM usuarios WHERE email = 'huellitas@petcat.test');
SET @u_guarderia = (SELECT id_usuario FROM usuarios WHERE email = 'guarderia@petcat.test');
SET @u_salud     = (SELECT id_usuario FROM usuarios WHERE email = 'saludanimal@petcat.test');
SET @u_vale      = (SELECT id_usuario FROM usuarios WHERE email = 'vet.salud@petcat.test');
SET @u_camilo    = (SELECT id_usuario FROM usuarios WHERE email = 'camilo@petcat.test');
SET @u_valeria   = (SELECT id_usuario FROM usuarios WHERE email = 'valeria@petcat.test');
SET @u_jorge     = (SELECT id_usuario FROM usuarios WHERE email = 'jorge@petcat.test');

INSERT INTO autorizaciones_datos (id_usuario, canal, id_usuario_registro, version_politica)
SELECT id_usuario, 'app', id_usuario, @version FROM usuarios
WHERE email IN ('huellitas@petcat.test', 'guarderia@petcat.test', 'saludanimal@petcat.test',
                'vet.salud@petcat.test', 'camilo@petcat.test', 'valeria@petcat.test');

-- ---------------------------------------------------------------------------
-- Peluquería Canina Huellitas (Venecia): rol propio "Estilista" y servicios con oferta
-- ---------------------------------------------------------------------------
INSERT INTO negocios (id_usuario_propietario, nombre, tipo, descripcion, telefono, whatsapp, email,
                      direccion, ciudad, latitud, longitud, verificado)
VALUES (@u_huellitas, 'Peluquería Canina Huellitas', 'peluqueria_canina',
        'Baño, corte y spa para perros y gatos en el barrio Venecia.',
        '6052802020', '3005550101', 'hola@huellitas.test',
        'Carrera 19 # 30-12, Venecia', 'Sincelejo', 9.31520000, -75.38850000, TRUE);
SET @n_huellitas = LAST_INSERT_ID();
INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin)
VALUES (@n_huellitas, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Gratuito'), 'mensual', 'activa', CURDATE(), '9999-12-31');

INSERT INTO sucursales (id_negocio, nombre, telefono, direccion, ciudad, latitud, longitud, es_principal)
VALUES (@n_huellitas, 'Sede Venecia', '6052802020', 'Carrera 19 # 30-12, Venecia', 'Sincelejo', 9.31520000, -75.38850000, TRUE);
SET @s_huellitas = LAST_INSERT_ID();
-- Lunes a sábado, jornada continua.
INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre)
SELECT @s_huellitas, d, '08:00:00', '18:00:00'
FROM (SELECT 1 AS d UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) dias;

INSERT INTO roles (id_negocio, nombre, descripcion, permisos_json)
VALUES (@n_huellitas, 'Estilista', 'Atiende baños y cortes; ve la agenda y los clientes.',
        '{"citas":["ver","ver_todas","editar"],"servicios":["ver"],"clientes":["ver"]}');
SET @rol_estilista = LAST_INSERT_ID();
-- Empleada sin cuenta en PetCat.
INSERT INTO empleados (id_negocio, id_rol, nombre, apellido, email, telefono, especialidad, fecha_vinculacion)
VALUES (@n_huellitas, @rol_estilista, 'Paola', 'Díaz', 'paola@huellitas.test', '3005550111', 'Estilismo canino',
        CURDATE() - INTERVAL 1 YEAR);
SET @e_paola = LAST_INSERT_ID();
-- Valentina (veterinaria de Salud Animal) también es recepcionista aquí: un usuario con
-- varios negocios para el selector del panel (A5). No atiende servicios en Huellitas.
INSERT INTO empleados (id_negocio, id_rol, id_usuario, nombre, apellido, email, telefono, fecha_vinculacion)
VALUES (@n_huellitas, (SELECT id_rol FROM roles WHERE nombre = 'Recepcionista' AND es_sistema = TRUE), @u_vale,
        'Valentina', 'Ruiz', 'vet.salud@petcat.test', '3005550404', CURDATE() - INTERVAL 6 MONTH);

SET @cat_bano = (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Baño y estética');
INSERT INTO servicios (id_negocio, id_categoria, nombre, descripcion, precio_base, duracion_minutos, margen_minutos, tipo_mascota,
                       en_oferta, precio_oferta, fecha_inicio_oferta, fecha_fin_oferta, dias_disponible, etiquetas_json) VALUES
(@n_huellitas, @cat_bano, 'Baño básico', 'Baño, secado y perfume.', 45000.00, 60, 15, 'perro',
 FALSE, NULL, NULL, NULL, NULL, '["bano"]'),
(@n_huellitas, @cat_bano, 'Baño y corte premium', 'Baño, corte de raza, uñas y limpieza de oídos.', 80000.00, 90, 15, 'perro',
 TRUE, 65000.00, CURDATE() - INTERVAL 5 DAY, CURDATE() + INTERVAL 20 DAY, NULL, '["premium","corte"]'),
(@n_huellitas, @cat_bano, 'Spa felino', 'Baño en seco y cepillado para gatos (solo sábados).', 70000.00, 60, 0, 'gato',
 FALSE, NULL, NULL, NULL, 'sabado', '["spa","gatos"]');
SET @sv_bano_basico  = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_huellitas AND nombre = 'Baño básico');
SET @sv_bano_premium = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_huellitas AND nombre = 'Baño y corte premium');
SET @sv_spa          = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_huellitas AND nombre = 'Spa felino');
INSERT INTO empleado_servicios (id_empleado, id_servicio)
VALUES (@e_paola, @sv_bano_basico), (@e_paola, @sv_bano_premium), (@e_paola, @sv_spa);

-- ---------------------------------------------------------------------------
-- Guardería Patas Felices (Boston): días hábiles, cupo diario y un servicio sin profesional
-- ---------------------------------------------------------------------------
INSERT INTO negocios (id_usuario_propietario, nombre, tipo, descripcion, telefono, whatsapp, email,
                      direccion, ciudad, latitud, longitud)
VALUES (@u_guarderia, 'Guardería Patas Felices', 'guarderia',
        'Guardería diurna con patio y adiestramiento básico.',
        '6052803030', '3005550202', 'contacto@patasfelices.test',
        'Calle 38 # 25-40, Boston', 'Sincelejo', 9.29680000, -75.40310000);
SET @n_guarderia = LAST_INSERT_ID();
INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin)
VALUES (@n_guarderia, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Gratuito'), 'mensual', 'activa', CURDATE(), '9999-12-31');

INSERT INTO sucursales (id_negocio, nombre, telefono, direccion, ciudad, latitud, longitud, es_principal)
VALUES (@n_guarderia, 'Sede Boston', '6052803030', 'Calle 38 # 25-40, Boston', 'Sincelejo', 9.29680000, -75.40310000, TRUE);
SET @s_guarderia = LAST_INSERT_ID();
INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre)
SELECT @s_guarderia, d, '07:00:00', '19:00:00'
FROM (SELECT 1 AS d UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) dias;

INSERT INTO empleados (id_negocio, id_rol, nombre, apellido, email, telefono, especialidad, fecha_vinculacion)
VALUES (@n_guarderia, (SELECT id_rol FROM roles WHERE nombre = 'Recepcionista' AND es_sistema = TRUE),
        'Diego', 'Mora', 'diego@patasfelices.test', '3005550222', 'Cuidado canino', CURDATE() - INTERVAL 6 MONTH);
SET @e_diego = LAST_INSERT_ID();

INSERT INTO servicios (id_negocio, id_categoria, nombre, descripcion, precio_base, tipo_precio, duracion_minutos, tipo_mascota, max_citas_dia) VALUES
(@n_guarderia, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Guardería'),
 'Guardería día completo', 'De 7:00 a 17:00, con paseo y comida.', 35000.00, 'por_dia', 600, 'perro', 8),
(@n_guarderia, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Guardería'),
 'Guardería medio día', 'Hasta 5 horas.', 20000.00, 'fijo', 300, 'perro', 8),
(@n_guarderia, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Entrenamiento'),
 'Adiestramiento básico', 'Obediencia básica. Aún sin entrenador asignado: no se puede reservar.', 50000.00, 'fijo', 60, 'perro', NULL);
SET @sv_guarderia_dia   = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_guarderia AND nombre = 'Guardería día completo');
SET @sv_guarderia_medio = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_guarderia AND nombre = 'Guardería medio día');
INSERT INTO empleado_servicios (id_empleado, id_servicio) VALUES (@e_diego, @sv_guarderia_dia), (@e_diego, @sv_guarderia_medio);

-- ---------------------------------------------------------------------------
-- Centro Veterinario Salud Animal 24h: dos sedes, plan Pro en prueba, destacado;
-- veterinaria con horario semanal, vacaciones y una jornada especial un domingo
-- ---------------------------------------------------------------------------
INSERT INTO negocios (id_usuario_propietario, nombre, tipo, descripcion, telefono, whatsapp, email,
                      direccion, ciudad, latitud, longitud, verificado, destacado)
VALUES (@u_salud, 'Centro Veterinario Salud Animal 24h', 'clinica',
        'Urgencias, consulta especializada, ecografía y hospitalización.',
        '6052804040', '3005550303', 'urgencias@saludanimal.test',
        'Avenida Las Peñitas # 12-30', 'Sincelejo', 9.32910000, -75.38490000, TRUE, TRUE);
SET @n_salud = LAST_INSERT_ID();
INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin, fecha_prueba_fin)
VALUES (@n_salud, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Pro'), 'mensual', 'en_prueba',
        CURDATE() - INTERVAL 4 DAY, CURDATE() + INTERVAL 10 DAY, CURDATE() + INTERVAL 10 DAY);

INSERT INTO sucursales (id_negocio, nombre, telefono, direccion, ciudad, latitud, longitud, es_principal) VALUES
(@n_salud, 'Sede Norte', '6052804040', 'Avenida Las Peñitas # 12-30', 'Sincelejo', 9.32910000, -75.38490000, TRUE),
(@n_salud, 'Sede Sur',   '6052804141', 'Calle 10 # 15-20, La Pollita', 'Sincelejo', 9.28870000, -75.39840000, FALSE);
SET @s_norte = (SELECT id_sucursal FROM sucursales WHERE id_negocio = @n_salud AND nombre = 'Sede Norte');
SET @s_sur   = (SELECT id_sucursal FROM sucursales WHERE id_negocio = @n_salud AND nombre = 'Sede Sur');
-- Norte: abierta las 24 horas, todos los días (00:00 a 23:59). Sur: horario partido de lunes a sábado.
INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre)
SELECT @s_norte, d, '00:00:00', '23:59:00'
FROM (SELECT 0 AS d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) dias;
INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre)
SELECT @s_sur, d, h.apertura, h.cierre
FROM (SELECT 1 AS d UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) dias
CROSS JOIN (SELECT '08:00:00' AS apertura, '12:00:00' AS cierre UNION SELECT '14:00:00', '18:00:00') h;

INSERT INTO empleados (id_negocio, id_rol, id_usuario, nombre, apellido, email, telefono,
                       especialidad, titulo_profesional, registro_profesional, fecha_vinculacion)
VALUES (@n_salud, (SELECT id_rol FROM roles WHERE nombre = 'Veterinario' AND es_sistema = TRUE), @u_vale,
        'Valentina', 'Ruiz', 'vet.salud@petcat.test', '3005550404',
        'Cirugía y urgencias', 'Médica Veterinaria', 'MV-67890', CURDATE() - INTERVAL 2 YEAR);
SET @e_vale = LAST_INSERT_ID();
-- El propietario también atiende; sin horario semanal propio, sigue el de la sucursal.
INSERT INTO empleados (id_negocio, id_rol, id_usuario, nombre, apellido, email, telefono, especialidad, fecha_vinculacion)
VALUES (@n_salud, (SELECT id_rol FROM roles WHERE nombre = 'Administrador' AND es_sistema = TRUE), @u_salud,
        'Ricardo', 'Mendoza', 'saludanimal@petcat.test', '3005550303', 'Medicina general', CURDATE() - INTERVAL 3 YEAR);
SET @e_ricardo = LAST_INSERT_ID();

-- Valentina: lunes a viernes en la Sede Norte (7:00-15:00) y sábados en la mañana en la Sede Sur.
INSERT INTO disponibilidad_empleado (id_empleado, id_sucursal, tipo, dia_semana, hora_inicio, hora_fin)
SELECT @e_vale, @s_norte, 'horario_normal', d, '07:00:00', '15:00:00'
FROM (SELECT 1 AS d UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) dias;
INSERT INTO disponibilidad_empleado (id_empleado, id_sucursal, tipo, dia_semana, hora_inicio, hora_fin)
VALUES (@e_vale, @s_sur, 'horario_normal', 6, '08:00:00', '12:00:00');
INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica, fecha_fin, motivo)
VALUES (@e_vale, 'vacacion', @vac_desde, @vac_hasta, 'Vacaciones');
INSERT INTO disponibilidad_empleado (id_empleado, id_sucursal, tipo, fecha_especifica, hora_inicio, hora_fin, motivo)
VALUES (@e_vale, @s_norte, 'evento_especial', @domingo, '09:00:00', '13:00:00', 'Jornada de vacunación');

SET @cat_consulta = (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Consulta y diagnóstico');
INSERT INTO servicios (id_negocio, id_categoria, nombre, descripcion, precio_base, precio_maximo, tipo_precio, duracion_minutos,
                       margen_minutos, tipo_mascota, requiere_cita, en_oferta, precio_oferta, fecha_inicio_oferta, fecha_fin_oferta) VALUES
(@n_salud, @cat_consulta, 'Consulta especializada', 'Valoración por especialista.', 90000.00, NULL, 'fijo', 45, 15, 'perro,gato,conejo',
 TRUE, FALSE, NULL, NULL, NULL),
(@n_salud, @cat_consulta, 'Urgencias', 'Atención de urgencias; el precio final depende del caso.', 120000.00, 300000.00, 'variable', 60, 0, 'todos',
 TRUE, FALSE, NULL, NULL, NULL),
(@n_salud, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Laboratorio y diagnóstico'),
 'Ecografía abdominal', 'Ecografía con informe el mismo día.', 110000.00, NULL, 'fijo', 30, 15, 'perro,gato',
 TRUE, FALSE, NULL, NULL, NULL),
-- Oferta ya vencida: se muestra a precio normal.
(@n_salud, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Desparasitación'),
 'Desparasitación', 'Interna y externa.', 35000.00, NULL, 'fijo', 15, 0, 'todos',
 TRUE, TRUE, 25000.00, CURDATE() - INTERVAL 40 DAY, CURDATE() - INTERVAL 10 DAY),
-- Sin cita: se atiende por orden de llegada.
(@n_salud, (SELECT id_categoria FROM categorias_servicio WHERE nombre = 'Hospitalización'),
 'Hospitalización', 'Internación con monitoreo 24 horas.', 150000.00, NULL, 'por_dia', 1440, 0, 'todos',
 FALSE, FALSE, NULL, NULL, NULL);
SET @sv_consulta_esp = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_salud AND nombre = 'Consulta especializada');
SET @sv_urgencias    = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_salud AND nombre = 'Urgencias');
SET @sv_eco          = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_salud AND nombre = 'Ecografía abdominal');
SET @sv_despara      = (SELECT id_servicio FROM servicios WHERE id_negocio = @n_salud AND nombre = 'Desparasitación');
INSERT INTO empleado_servicios (id_empleado, id_servicio) VALUES
(@e_vale, @sv_consulta_esp), (@e_vale, @sv_urgencias), (@e_vale, @sv_eco), (@e_vale, @sv_despara),
(@e_ricardo, @sv_consulta_esp), (@e_ricardo, @sv_despara);

-- Jorge lo registró Salud Animal desde el panel (el negocio tomó la autorización).
INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica)
VALUES (@u_jorge, 'panel', @n_salud, @u_salud, @version);

-- Oferta vigente en la vacuna de Patitas.
UPDATE servicios SET en_oferta = TRUE, precio_oferta = 38000.00,
       fecha_inicio_oferta = CURDATE() - INTERVAL 3 DAY, fecha_fin_oferta = CURDATE() + INTERVAL 30 DAY
WHERE id_negocio = @id_negocio AND nombre = 'Vacuna antirrábica';
SET @sv_consulta = (SELECT id_servicio FROM servicios WHERE id_negocio = @id_negocio AND nombre = 'Consulta general');
SET @sv_vacuna   = (SELECT id_servicio FROM servicios WHERE id_negocio = @id_negocio AND nombre = 'Vacuna antirrábica');

-- Carlos no atiende la próxima tarde del quinto día (capacitación).
INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica, hora_inicio, hora_fin, motivo)
VALUES (@id_veterinario, 'bloqueo', @f5, '14:00:00', '18:00:00', 'Capacitación');

-- ---------------------------------------------------------------------------
-- Mascotas
-- ---------------------------------------------------------------------------
SET @m_max  = (SELECT id_mascota FROM mascotas WHERE id_usuario = @id_cliente AND nombre = 'Max');
SET @m_luna = (SELECT id_mascota FROM mascotas WHERE id_usuario = @id_cliente AND nombre = 'Luna');
INSERT INTO mascotas (id_usuario, nombre, especie, raza, color, fecha_nacimiento, sexo, peso, esterilizado, tiene_alergias,
                      alergias_detalle, condiciones_medicas, compartir_historial, fallecido, fecha_fallecimiento) VALUES
-- Rocky no comparte su historial: cada negocio ve solo el historial clínico que registró.
(@u_camilo,  'Rocky',  'perro',  'Bulldog francés', 'Atigrado', '2020-05-10', 'macho',  12.30, TRUE,  TRUE,
 'Pollo y derivados', 'Braquicefálico: evitar el calor', FALSE, FALSE, NULL),
(@u_camilo,  'Mía',    'gato',   'Siamés',          'Crema',    '2022-11-02', 'hembra',  4.10, TRUE,  FALSE, NULL, NULL, TRUE, FALSE, NULL),
(@u_valeria, 'Copito', 'conejo', 'Cabeza de león',  'Blanco',   '2023-02-14', 'macho',   1.90, FALSE, FALSE, NULL, NULL, TRUE, FALSE, NULL),
(@u_valeria, 'Nala',   'perro',  'Criolla',         'Canela',   '2012-06-01', 'hembra', 18.00, TRUE,  FALSE, NULL,
 'Artrosis', TRUE, TRUE, CURDATE() - INTERVAL 90 DAY),
(@u_jorge,   'Toby',   'perro',  'Beagle',          'Tricolor', '2019-08-20', 'macho',  14.00, TRUE,  FALSE, NULL, NULL, TRUE, FALSE, NULL);
SET @m_rocky  = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_camilo  AND nombre = 'Rocky');
SET @m_mia    = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_camilo  AND nombre = 'Mía');
SET @m_copito = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_valeria AND nombre = 'Copito');
SET @m_nala   = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_valeria AND nombre = 'Nala');
SET @m_toby   = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_jorge   AND nombre = 'Toby');

-- ---------------------------------------------------------------------------
-- Citas en todos los estados: pasadas, de hoy y futuras
-- ---------------------------------------------------------------------------
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, precio_final, origen, notas_cliente, notas_internas) VALUES
-- Patitas
(@id_negocio, @id_sucursal, @id_cliente, @m_max,   @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 60 DAY, '09:00:00', '09:30:00',
 'completada', 60000, 60000, 'app_movil', 'Control anual', NULL),
(@id_negocio, @id_sucursal, @id_cliente, @m_max,   @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 15 DAY, '10:00:00', '10:30:00',
 'completada', 60000, 65000, 'app_movil', 'Se rasca mucho la oreja', 'Se cobró el medicamento'),
(@id_negocio, @id_sucursal, @id_cliente, @m_luna,  @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 20 DAY, '11:00:00', '11:30:00',
 'no_asistio', 60000, NULL, 'app_movil', NULL, 'No contestó las llamadas'),
(@id_negocio, @id_sucursal, @id_cliente, @m_max,   @sv_vacuna,   @id_veterinario, @f3, '09:00:00', '09:15:00',
 'confirmada', 38000, NULL, 'app_movil', NULL, NULL),
(@id_negocio, @id_sucursal, @id_cliente, @m_luna,  @sv_consulta, @id_veterinario, @f7, '10:00:00', '10:30:00',
 'pendiente', 60000, NULL, 'app_movil', 'Está comiendo poco', NULL),
(@id_negocio, @id_sucursal, @u_camilo,   @m_rocky, @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 30 DAY, '08:00:00', '08:30:00',
 'completada', 60000, 60000, 'telefono', NULL, NULL),
-- Huellitas
(@n_huellitas, @s_huellitas, @u_camilo,   @m_rocky, @sv_bano_basico,  @e_paola, CURDATE() - INTERVAL 10 DAY, '09:00:00', '10:00:00',
 'completada', 45000, 45000, 'app_movil', NULL, NULL),
(@n_huellitas, @s_huellitas, @id_cliente, @m_max,   @sv_bano_premium, @e_paola, @f5, '14:00:00', '15:30:00',
 'confirmada', 65000, NULL, 'app_movil', 'Corte corto, por favor', NULL),
(@n_huellitas, @s_huellitas, @u_camilo,   @m_mia,   @sv_spa,          @e_paola, @sabado, '10:00:00', '11:00:00',
 'pendiente', 70000, NULL, 'app_movil', NULL, NULL),
-- Guardería
(@n_guarderia, @s_guarderia, @u_camilo,  @m_rocky, @sv_guarderia_dia,   @e_diego, CURDATE() - INTERVAL 7 DAY, '07:00:00', '17:00:00',
 'completada', 35000, 35000, 'app_movil', NULL, NULL),
(@n_guarderia, @s_guarderia, @u_camilo,  @m_rocky, @sv_guarderia_dia,   @e_diego, @f4_habil, '07:00:00', '17:00:00',
 'confirmada', 35000, NULL, 'app_movil', NULL, NULL),
(@n_guarderia, @s_guarderia, @u_valeria, @m_nala,  @sv_guarderia_medio, @e_diego, CURDATE() - INTERVAL 200 DAY, '07:00:00', '12:00:00',
 'completada', 20000, 20000, 'presencial', NULL, NULL),
-- Salud Animal
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_urgencias,    @e_vale,    CURDATE() - INTERVAL 45 DAY, '14:00:00', '15:00:00',
 'completada', 120000, 180000, 'telefono', 'Vomitó toda la noche', 'Posible ingesta de pollo'),
(@n_salud, @s_norte, @u_jorge,   @m_toby,   @sv_consulta_esp, @e_ricardo, CURDATE(), '07:00:00', '07:45:00',
 'en_curso', 90000, NULL, 'presencial', NULL, 'Llegó con cojera'),
(@n_salud, @s_sur,   @u_jorge,   @m_toby,   @sv_eco,          @e_vale,    CURDATE() - INTERVAL 12 DAY, '09:00:00', '09:30:00',
 'no_asistio', 110000, NULL, 'telefono', NULL, NULL),
(@n_salud, @s_sur,   @u_valeria, @m_copito, @sv_despara,      @e_ricardo, CURDATE() - INTERVAL 90 DAY, '15:00:00', '15:15:00',
 'completada', 35000, 35000, 'app_movil', NULL, NULL),
(@n_salud, @s_norte, @u_camilo,  @m_mia,    @sv_consulta_esp, @e_ricardo, @f2, '16:00:00', '16:45:00',
 'confirmada', 90000, NULL, 'app_movil', NULL, NULL),
-- Cae en las vacaciones de Valentina: la agenda la marca con fuera_de_disponibilidad.
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_consulta_esp, @e_vale,    @f22, '08:00:00', '08:45:00',
 'confirmada', 90000, NULL, 'app_movil', 'Control de la piel', NULL);

-- Cancelaciones: una tardía de la dueña y una del negocio con motivo.
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen, motivo_cancelacion, cancelada_por, fecha_cancelacion, cancelacion_tardia) VALUES
(@id_negocio,  @id_sucursal, @id_cliente, @m_luna, @sv_consulta,    @id_veterinario, CURDATE() - INTERVAL 5 DAY, '10:00:00', '10:30:00',
 'cancelada', 60000, 'app_movil', 'Se me presentó un viaje', 'dueno', CONCAT(CURDATE() - INTERVAL 5 DAY, ' 09:15:00'), TRUE),
(@n_huellitas, @s_huellitas, @id_cliente, @m_max,  @sv_bano_basico, @e_paola,        CURDATE() - INTERVAL 3 DAY, '11:00:00', '12:00:00',
 'cancelada', 45000, 'app_movil', 'La estilista está incapacitada', 'negocio', CONCAT(CURDATE() - INTERVAL 4 DAY, ' 17:00:00'), FALSE);

-- Reprogramación desde la app: la original queda reprogramada y la nueva, pendiente.
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen)
VALUES (@n_salud, @s_norte, @u_valeria, @m_copito, @sv_consulta_esp, @e_ricardo, @f2, '10:00:00', '10:45:00', 'reprogramada', 90000, 'app_movil');
SET @c_original = LAST_INSERT_ID();
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen, id_cita_origen)
VALUES (@n_salud, @s_norte, @u_valeria, @m_copito, @sv_consulta_esp, @e_ricardo, @f9, '10:00:00', '10:45:00', 'pendiente', 90000, 'app_movil', @c_original);
SET @c_nueva = LAST_INSERT_ID();
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, motivo)
VALUES (@c_original, @u_valeria, 'estado', 'confirmada', 'reprogramada', CONCAT('Reprogramada a la cita #', @c_nueva));

UPDATE negocios n
SET total_citas = (SELECT COUNT(*) FROM citas c WHERE c.id_negocio = n.id_negocio AND c.estado = 'completada');

-- Se completaron al terminar su horario (plazo para reseñar, migración 018).
UPDATE citas SET fecha_completada = TIMESTAMP(fecha, hora_fin) WHERE estado = 'completada';

-- ---------------------------------------------------------------------------
-- Historial médico (con notas internas de cada negocio)
-- ---------------------------------------------------------------------------
INSERT INTO historial_medico (id_mascota, id_cita, id_empleado, id_negocio, tipo, motivo_consulta, diagnostico,
                              indicaciones, proximo_control, peso_registro, temperatura, notas_internas, fecha)
SELECT @m_max, c.id_cita, @id_veterinario, @id_negocio, 'consulta_general', 'Control anual', 'Sano',
       'Mantener la dieta y el ejercicio', CURDATE() - INTERVAL 30 DAY, 27.20, 38.6, 'Dueña muy puntual', c.fecha
FROM citas c WHERE c.id_mascota = @m_max AND c.id_negocio = @id_negocio AND c.fecha = CURDATE() - INTERVAL 60 DAY;
INSERT INTO historial_medico (id_mascota, id_cita, id_empleado, id_negocio, tipo, motivo_consulta, diagnostico, tratamiento,
                              medicamentos_prescritos, proximo_control, peso_registro, temperatura, fecha)
SELECT @m_max, c.id_cita, @id_veterinario, @id_negocio, 'consulta_general', 'Se rasca la oreja', 'Otitis externa leve',
       'Limpieza y gotas óticas', 'Gotas óticas, 5 gotas cada 12 horas por 7 días', CURDATE() + INTERVAL 20 DAY, 28.50, 38.9, c.fecha
FROM citas c WHERE c.id_mascota = @m_max AND c.id_negocio = @id_negocio AND c.fecha = CURDATE() - INTERVAL 15 DAY;
INSERT INTO historial_medico (id_mascota, id_cita, id_empleado, id_negocio, tipo, motivo_consulta, diagnostico, tratamiento,
                              peso_registro, notas_internas, fecha)
SELECT @m_rocky, c.id_cita, @id_veterinario, @id_negocio, 'consulta_general', 'Picazón en la piel', 'Dermatitis alérgica',
       'Dieta hipoalergénica', 12.00, 'Revisar que no le den pollo', c.fecha
FROM citas c WHERE c.id_mascota = @m_rocky AND c.id_negocio = @id_negocio;
INSERT INTO historial_medico (id_mascota, id_cita, id_empleado, id_negocio, tipo, motivo_consulta, diagnostico, tratamiento,
                              medicamentos_prescritos, peso_registro, temperatura, frecuencia_cardiaca, notas_internas, fecha)
SELECT @m_rocky, c.id_cita, @e_vale, @n_salud, 'urgencia', 'Vómito toda la noche', 'Gastroenteritis por intolerancia alimentaria',
       'Fluidoterapia y ayuno de 12 horas', 'Omeprazol 10 mg por 5 días', 12.30, 39.4, 130, 'No siguió la dieta indicada', c.fecha
FROM citas c WHERE c.id_mascota = @m_rocky AND c.id_negocio = @n_salud AND c.estado = 'completada';
-- Max sí comparte su historial: Patitas ve también este registro de Salud Animal (sin cita: una
-- urgencia atendida antes de que la plataforma registrara sus citas), en solo lectura.
INSERT INTO historial_medico (id_mascota, id_empleado, id_negocio, tipo, motivo_consulta, diagnostico, tratamiento,
                              peso_registro, temperatura, notas_internas, fecha)
VALUES (@m_max, @e_vale, @n_salud, 'urgencia', 'Cojera de la pata trasera', 'Esguince leve', 'Reposo y antiinflamatorio por 5 días',
        26.80, 38.7, 'Nota interna de Salud Animal: Patitas no la ve', CURDATE() - INTERVAL 200 DAY);
INSERT INTO historial_medico (id_mascota, id_cita, id_empleado, id_negocio, tipo, diagnostico, tratamiento, peso_registro, fecha)
SELECT @m_copito, c.id_cita, @e_ricardo, @n_salud, 'desparasitacion', 'Sin parásitos visibles', 'Desparasitación preventiva', 1.80, c.fecha
FROM citas c WHERE c.id_mascota = @m_copito AND c.id_negocio = @n_salud AND c.estado = 'completada';

-- ---------------------------------------------------------------------------
-- Vacunas: vencida, próximas (aviso de 30 días), al día, del dueño y dosis
-- reemplazadas por una más reciente (no_aplica)
-- ---------------------------------------------------------------------------
INSERT INTO vacunas (id_mascota, id_empleado, id_negocio, registrada_por, id_usuario_registro, nombre_vacuna, laboratorio, lote,
                     dosis, fecha_aplicacion, fecha_proxima, estado, comprobante_url) VALUES
(@m_max,    NULL,            NULL,        'dueno',   @id_cliente,     'Antirrábica',   NULL,     NULL,      '1a dosis',
 CURDATE() - INTERVAL 800 DAY, CURDATE() - INTERVAL 435 DAY, 'no_aplica', 'https://cdn.petcat.test/carnet-max.jpg'),
(@m_max,    @id_veterinario, @id_negocio, 'negocio', @id_usuario_vet, 'Antirrábica',   'Zoetis', 'RB-2291', 'Refuerzo anual',
 CURDATE() - INTERVAL 400 DAY, CURDATE() - INTERVAL 35 DAY,  'vencido',   NULL),
(@m_max,    @id_veterinario, @id_negocio, 'negocio', @id_usuario_vet, 'Parvovirus',    'MSD',    'PV-1180', 'Refuerzo anual',
 CURDATE() - INTERVAL 340 DAY, CURDATE() + INTERVAL 25 DAY,  'proximo',   NULL),
(@m_luna,   NULL,            NULL,        'dueno',   @id_cliente,     'Triple felina', NULL,     NULL,      'Refuerzo anual',
 CURDATE() - INTERVAL 100 DAY, CURDATE() + INTERVAL 265 DAY, 'al_dia',    'https://cdn.petcat.test/carnet-luna.jpg'),
(@m_rocky,  @e_vale,         @n_salud,    'negocio', @u_vale,         'Antirrábica',   'Zoetis', 'RB-1002', 'Refuerzo anual',
 CURDATE() - INTERVAL 730 DAY, CURDATE() - INTERVAL 365 DAY, 'no_aplica', NULL),
(@m_rocky,  @e_vale,         @n_salud,    'negocio', @u_vale,         'Antirrábica',   'Zoetis', 'RB-2410', 'Refuerzo anual',
 CURDATE() - INTERVAL 30 DAY,  CURDATE() + INTERVAL 335 DAY, 'al_dia',    NULL),
(@m_copito, @e_ricardo,      @n_salud,    'negocio', @u_salud,        'Mixomatosis',   'Hipra',  'MX-0033', 'Refuerzo semestral',
 CURDATE() - INTERVAL 175 DAY, CURDATE() + INTERVAL 5 DAY,   'proximo',   NULL),
-- Panel P6.2: vencida hace 12 días (Camilo es cliente de Patitas): "vacunas vencidas en los últimos 30 días".
(@m_rocky,  NULL,            NULL,        'dueno',   @u_camilo,       'Moquillo',      NULL,     NULL,      'Refuerzo anual',
 CURDATE() - INTERVAL 377 DAY, CURDATE() - INTERVAL 12 DAY,  'vencido',   NULL);

-- ---------------------------------------------------------------------------
-- Reseñas de citas completadas (el trigger actualiza la calificación del negocio)
-- ---------------------------------------------------------------------------
INSERT INTO resenas (id_negocio, id_usuario, id_cita, calificacion, titulo, comentario, calif_atencion, calif_puntualidad)
SELECT c.id_negocio, c.id_usuario, c.id_cita, r.calificacion, r.titulo, r.comentario, r.calificacion, r.puntualidad
FROM citas c
JOIN (
  SELECT @id_negocio AS id_negocio, @m_max AS id_mascota, CURDATE() - INTERVAL 60 DAY AS fecha, 5 AS calificacion, 5 AS puntualidad,
         'Excelente atención' AS titulo, 'El doctor Carlos fue muy amable con Max.' AS comentario
  UNION ALL SELECT @n_huellitas, @m_rocky, CURDATE() - INTERVAL 10 DAY, 4, 3, 'Muy buen baño', 'Rocky quedó limpio, pero tardaron un poco.'
  UNION ALL SELECT @n_guarderia, @m_rocky, CURDATE() - INTERVAL 7 DAY, 5, 5, 'Rocky feliz', 'Volvió cansado y contento.'
  UNION ALL SELECT @n_salud, @m_rocky, CURDATE() - INTERVAL 45 DAY, 5, 5, 'Nos salvaron la noche', 'Atención rápida en urgencias.'
) r ON r.id_negocio = c.id_negocio AND r.id_mascota = c.id_mascota AND r.fecha = c.fecha
WHERE c.estado = 'completada';

-- ═══════════════════════════════════════════════════════════════════════════
--  Fase 2: dashboard, límites del plan, confirmación automática, reseñas,
--  notificaciones, dispositivos y notas de clientes
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- Salud Animal (Pro en prueba, con estadísticas avanzadas): citas completadas
-- repartidas en los últimos 90 días para la tendencia y la comparación del dashboard
-- ---------------------------------------------------------------------------
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, precio_final, origen) VALUES
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_consulta_esp, @e_vale,    CURDATE() - INTERVAL 84 DAY, '09:00:00', '09:45:00', 'completada',  90000,  90000, 'app_movil'),
(@n_salud, @s_norte, @u_camilo,  @m_mia,    @sv_consulta_esp, @e_ricardo, CURDATE() - INTERVAL 77 DAY, '16:00:00', '16:45:00', 'completada',  90000,  90000, 'app_movil'),
(@n_salud, @s_sur,   @u_valeria, @m_copito, @sv_despara,      @e_ricardo, CURDATE() - INTERVAL 70 DAY, '15:00:00', '15:15:00', 'completada',  35000,  35000, 'app_movil'),
(@n_salud, @s_norte, @u_jorge,   @m_toby,   @sv_eco,          @e_vale,    CURDATE() - INTERVAL 63 DAY, '10:00:00', '10:30:00', 'completada', 110000, 110000, 'telefono'),
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_eco,          @e_vale,    CURDATE() - INTERVAL 56 DAY, '11:00:00', '11:30:00', 'completada', 110000, 110000, 'app_movil'),
(@n_salud, @s_norte, @u_camilo,  @m_mia,    @sv_despara,      @e_ricardo, CURDATE() - INTERVAL 49 DAY, '17:00:00', '17:15:00', 'completada',  35000,  35000, 'app_movil'),
(@n_salud, @s_norte, @u_valeria, @m_copito, @sv_consulta_esp, @e_ricardo, CURDATE() - INTERVAL 38 DAY, '10:00:00', '10:45:00', 'completada',  90000,  95000, 'app_movil'),
(@n_salud, @s_norte, @u_jorge,   @m_toby,   @sv_consulta_esp, @e_ricardo, CURDATE() - INTERVAL 31 DAY, '08:00:00', '08:45:00', 'completada',  90000,  90000, 'presencial'),
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_consulta_esp, @e_vale,    CURDATE() - INTERVAL 24 DAY, '09:00:00', '09:45:00', 'completada',  90000,  90000, 'app_movil'),
(@n_salud, @s_norte, @u_jorge,   @m_toby,   @sv_consulta_esp, @e_ricardo, CURDATE() - INTERVAL 20 DAY, '08:00:00', '08:45:00', 'completada',  90000,  90000, 'presencial'),
(@n_salud, @s_norte, @u_camilo,  @m_mia,    @sv_eco,          @e_vale,    CURDATE() - INTERVAL 17 DAY, '11:00:00', '11:30:00', 'completada', 110000, 110000, 'app_movil'),
(@n_salud, @s_sur,   @u_valeria, @m_copito, @sv_despara,      @e_ricardo, CURDATE() - INTERVAL 9 DAY,  '15:00:00', '15:15:00', 'completada',  35000,  35000, 'app_movil'),
(@n_salud, @s_norte, @u_camilo,  @m_rocky,  @sv_urgencias,    @e_vale,    CURDATE() - INTERVAL 3 DAY,  '19:00:00', '20:00:00', 'completada', 120000, 150000, 'telefono'),
-- Completada hoy a las 07:45: su invitación a reseñar sale a las 10:45 (más abajo).
(@n_salud, @s_norte, @u_camilo,  @m_mia,    @sv_consulta_esp, @e_vale,    CURDATE(),                   '07:00:00', '07:45:00', 'completada',  90000,  90000, 'app_movil');

-- ---------------------------------------------------------------------------
-- Patitas (Gratuito, sin confirmación automática): dos citas que se cancelaron
-- solas porque nadie las confirmó. No cuentan contra los clientes; el dashboard
-- sugiere activar la confirmación automática.
-- ---------------------------------------------------------------------------
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen, motivo_cancelacion, cancelada_por, fecha_cancelacion, cancelacion_tardia,
                   confirmar_antes_de) VALUES
(@id_negocio, @id_sucursal, @u_camilo,   @m_rocky, @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 12 DAY, '15:00:00', '15:30:00',
 'cancelada', 60000, 'app_movil', 'El negocio no confirmó la cita a tiempo', 'sistema',
 CONCAT(CURDATE() - INTERVAL 13 DAY, ' 15:00:00'), FALSE, CONCAT(CURDATE() - INTERVAL 13 DAY, ' 15:00:00')),
(@id_negocio, @id_sucursal, @id_cliente, @m_luna,  @sv_consulta, @id_veterinario, CURDATE() - INTERVAL 26 DAY, '09:00:00', '09:30:00',
 'cancelada', 60000, 'app_movil', 'El negocio no confirmó la cita a tiempo', 'sistema',
 CONCAT(CURDATE() - INTERVAL 27 DAY, ' 09:00:00'), FALSE, CONCAT(CURDATE() - INTERVAL 27 DAY, ' 09:00:00'));
-- El historial de la cancelación automática va sin usuario ni empleado (realizado_por: sistema).
INSERT INTO historial_citas (id_cita, campo_modificado, valor_anterior, valor_nuevo, motivo, fecha_cambio)
SELECT id_cita, 'estado', 'pendiente', 'cancelada', motivo_cancelacion, fecha_cancelacion
FROM citas WHERE id_negocio = @id_negocio AND cancelada_por = 'sistema';

-- ---------------------------------------------------------------------------
-- Guardería Patas Felices (Gratuito) cerca de sus límites: 3 de 3 empleados y unas
-- 25 de 30 citas del mes, con el aviso del 80 %. Sus clientes nuevos no tienen app:
-- los registró la guardería desde el panel.
-- ---------------------------------------------------------------------------
INSERT INTO empleados (id_negocio, id_rol, nombre, apellido, email, telefono, especialidad, fecha_vinculacion) VALUES
(@n_guarderia, (SELECT id_rol FROM roles WHERE nombre = 'Recepcionista' AND es_sistema = TRUE),
 'Sara', 'Gil', 'sara@patasfelices.test', '3005550233', 'Recepción', CURDATE() - INTERVAL 3 MONTH),
(@n_guarderia, (SELECT id_rol FROM roles WHERE nombre = 'Recepcionista' AND es_sistema = TRUE),
 'Tomás', 'León', 'tomas@patasfelices.test', '3005550244', 'Paseos', CURDATE() - INTERVAL 1 MONTH);

INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado) VALUES
('Andrea', 'Paz',    'andrea@petcat.test', @password_hash, '3008880101', 'cliente', FALSE),
('Luis',   'Ortega', 'luis@petcat.test',   @password_hash, '3008880202', 'cliente', FALSE),
('Marta',  'Díaz',   'marta@petcat.test',  @password_hash, '3008880303', 'cliente', FALSE);
SET @u_andrea = (SELECT id_usuario FROM usuarios WHERE email = 'andrea@petcat.test');
SET @u_luis   = (SELECT id_usuario FROM usuarios WHERE email = 'luis@petcat.test');
SET @u_marta  = (SELECT id_usuario FROM usuarios WHERE email = 'marta@petcat.test');
INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica)
SELECT id_usuario, 'panel', @n_guarderia, @u_guarderia, @version FROM usuarios
WHERE email IN ('andrea@petcat.test', 'luis@petcat.test', 'marta@petcat.test');

INSERT INTO mascotas (id_usuario, nombre, especie, raza, sexo, fecha_nacimiento, peso) VALUES
(@u_andrea, 'Bruno', 'perro', 'Golden retriever', 'macho',  '2022-01-10', 30.00),
(@u_andrea, 'Kira',  'perro', 'Pinscher',         'hembra', '2023-04-22',  4.50),
(@u_luis,   'Simón', 'perro', 'Border collie',    'macho',  '2021-09-05', 19.00),
(@u_luis,   'Lola',  'perro', 'Criolla',          'hembra', '2020-12-12', 11.00),
(@u_marta,  'Coco',  'perro', 'Poodle',           'macho',  '2019-06-30',  7.00);

-- Cinco perros en cinco días hábiles del mes en curso (días 2, 6, 10, 14 y 18, o el lunes
-- siguiente si caen en fin de semana): completadas las pasadas, confirmadas las demás.
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, precio_final, origen)
SELECT @n_guarderia, @s_guarderia, m.id_usuario, m.id_mascota, @sv_guarderia_dia, @e_diego, d.fecha, '07:00:00', '17:00:00',
       IF(d.fecha < CURDATE(), 'completada', 'confirmada'), 35000, IF(d.fecha < CURDATE(), 35000, NULL), 'presencial'
FROM (
  SELECT b.base + INTERVAL (CASE DAYOFWEEK(b.base) WHEN 7 THEN 2 WHEN 1 THEN 1 ELSE 0 END) DAY AS fecha
  FROM (
    SELECT CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE) + INTERVAL (k.k - 1) DAY AS base
    FROM (SELECT 2 AS k UNION SELECT 6 UNION SELECT 10 UNION SELECT 14 UNION SELECT 18) k
  ) b
) d
CROSS JOIN mascotas m
WHERE m.id_usuario IN (@u_andrea, @u_luis, @u_marta);

-- ---------------------------------------------------------------------------
-- Fechas de completada, contador de citas e invitación a reseñar pendiente
-- ---------------------------------------------------------------------------
UPDATE citas SET fecha_completada = TIMESTAMP(fecha, hora_fin) WHERE estado = 'completada' AND fecha_completada IS NULL;
UPDATE negocios n
SET total_citas = (SELECT COUNT(*) FROM citas c WHERE c.id_negocio = n.id_negocio AND c.estado = 'completada');

-- La consulta de Mía de hoy (07:45) invita a reseñar 3 horas después. Si el seed se carga
-- después de las 10:45, el job la envía en su siguiente corrida.
INSERT INTO recordatorios (id_usuario, id_mascota, id_cita, tipo, titulo, mensaje, canal, fecha_programada)
SELECT id_usuario, id_mascota, id_cita, 'resena_invitacion', 'Invitación a reseñar', 'Invitación a reseñar la cita completada',
       'push', TIMESTAMP(CURDATE(), '10:45:00')
FROM citas WHERE id_negocio = @n_salud AND id_mascota = @m_mia AND fecha = CURDATE() AND estado = 'completada';

-- ---------------------------------------------------------------------------
-- Reseñas: fechas realistas, respuesta, una editada después de la respuesta, una
-- reportada (sigue visible) y una de un cliente registrado por el negocio
-- ---------------------------------------------------------------------------
UPDATE resenas r JOIN citas c ON c.id_cita = r.id_cita
SET r.fecha_creacion = TIMESTAMP(c.fecha + INTERVAL 1 DAY, '18:30:00');

-- Patitas respondió la reseña de Sofía.
UPDATE resenas r JOIN citas c ON c.id_cita = r.id_cita
SET r.respuesta_negocio = '¡Gracias, Sofía! Max es un paciente muy juicioso. Lo esperamos en su próximo control.',
    r.fecha_respuesta = r.fecha_creacion + INTERVAL 1 DAY
WHERE r.id_negocio = @id_negocio AND c.id_mascota = @m_max;

-- Huellitas respondió a Camilo y él editó su reseña después (bajó a 3 estrellas).
UPDATE resenas r JOIN citas c ON c.id_cita = r.id_cita
SET r.respuesta_negocio = 'Gracias por venir, Camilo. Ese día tuvimos mucha demanda; ya reforzamos el equipo.',
    r.fecha_respuesta = r.fecha_creacion + INTERVAL 1 DAY
WHERE r.id_negocio = @n_huellitas AND c.id_mascota = @m_rocky;
UPDATE resenas r JOIN citas c ON c.id_cita = r.id_cita
SET r.calificacion = 3, r.comentario = 'Rocky quedó limpio, pero tardaron más de una hora en entregarlo.',
    r.fecha_edicion = r.fecha_respuesta + INTERVAL 1 DAY
WHERE r.id_negocio = @n_huellitas AND c.id_mascota = @m_rocky;

-- Valeria critica a Salud Animal y el negocio la reportó: sigue visible hasta que la revise PetCat.
INSERT INTO resenas (id_negocio, id_usuario, id_cita, calificacion, titulo, comentario, calif_precio,
                     reportada, motivo_reporte, detalle_reporte, fecha_reporte, id_usuario_reporta, fecha_creacion)
SELECT @n_salud, @u_valeria, c.id_cita, 2, 'Caro para lo que es', 'Me cobraron la desparasitación sin la oferta.', 1,
       TRUE, 'otro', 'La oferta había vencido y el precio fue el publicado.', TIMESTAMP(c.fecha + INTERVAL 3 DAY, '09:00:00'), @u_salud,
       TIMESTAMP(c.fecha + INTERVAL 1 DAY, '20:00:00')
FROM citas c WHERE c.id_negocio = @n_salud AND c.id_mascota = @m_copito AND c.fecha = CURDATE() - INTERVAL 90 DAY;

-- Jorge (registrado desde el panel de Salud Animal) reseña su consulta: la señal para la
-- moderación queda en TRUE (solo la ve el super admin).
INSERT INTO resenas (id_negocio, id_usuario, id_cita, calificacion, titulo, comentario, calif_atencion,
                     cliente_registrado_por_negocio, fecha_creacion)
SELECT @n_salud, @u_jorge, c.id_cita, 5, 'Muy profesionales', 'Toby ya camina bien.', 5,
       EXISTS (SELECT 1 FROM autorizaciones_datos a WHERE a.id_usuario = @u_jorge AND a.id_negocio = @n_salud AND a.canal = 'panel'),
       TIMESTAMP(c.fecha + INTERVAL 1 DAY, '12:00:00')
FROM citas c WHERE c.id_negocio = @n_salud AND c.id_mascota = @m_toby AND c.fecha = CURDATE() - INTERVAL 20 DAY;

-- ---------------------------------------------------------------------------
-- Notas de los negocios sobre sus clientes (solo las ve cada negocio)
-- ---------------------------------------------------------------------------
INSERT INTO notas_cliente (id_negocio, id_usuario, id_usuario_autor, texto, fecha_creacion) VALUES
(@n_salud,     @u_jorge,  @u_salud,     'Prefiere que lo llamen en la tarde; en la mañana no contesta.', NOW() - INTERVAL 12 DAY),
(@n_salud,     @u_camilo, @u_vale,      'Rocky se pone nervioso en la sala de espera: hacerlo pasar directo al consultorio.', NOW() - INTERVAL 24 DAY),
(@n_guarderia, @u_andrea, @u_guarderia, 'Kira no se lleva con perros grandes: separarla de Bruno en el patio.', NOW() - INTERVAL 5 DAY);

-- ---------------------------------------------------------------------------
-- Dispositivos de ejemplo (tokens inventados: si el servidor intenta una push real,
-- Expo responde DeviceNotRegistered y el dispositivo queda desactivado)
-- ---------------------------------------------------------------------------
INSERT INTO dispositivos (id_usuario, token_expo, plataforma, nombre) VALUES
(@id_cliente, 'ExponentPushToken[seedSofiaAndroid00001]', 'android', 'Samsung Galaxy A54'),
(@u_camilo,   'ExponentPushToken[seedCamiloIphone000001]', 'ios',     'iPhone 13');

-- ---------------------------------------------------------------------------
-- Notificaciones en la app, leídas y sin leer (datos_extra_json.enlace es el deep link)
-- ---------------------------------------------------------------------------
INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, leida_en, fecha_creacion)
SELECT @id_cliente, @id_negocio, 'dueno', 'cita_confirmada', 'Cita confirmada',
       CONCAT('Clínica Veterinaria Patitas confirmó la cita de Max (Vacuna antirrábica) del ', DATE_FORMAT(c.fecha, '%d/%m/%Y'), ' a las 9:00 a. m.'),
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'cita_confirmada', 'id_cita', c.id_cita, 'id_negocio', @id_negocio)),
       'in_app', 'leida', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 2 DAY
FROM citas c WHERE c.id_negocio = @id_negocio AND c.id_mascota = @m_max AND c.estado = 'confirmada';

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, fecha_creacion)
SELECT @id_cliente, NULL, 'dueno', 'vacuna_proxima', 'Vacuna próxima',
       'La vacuna Parvovirus de Max vence pronto. Agenda la aplicación con tu veterinaria.',
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'vacuna_proxima', 'id_mascota', @m_max, 'id_vacuna', v.id_vacuna)),
       'in_app', 'enviada', NOW() - INTERVAL 3 HOUR
FROM vacunas v WHERE v.id_mascota = @m_max AND v.nombre_vacuna = 'Parvovirus';

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, fecha_creacion)
SELECT @id_propietario, @id_negocio, 'negocio', 'cita_nueva', 'Nueva cita por confirmar',
       'Sofía Gómez reservó Consulta general para Luna. Queda pendiente hasta que la confirmes.',
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'cita_nueva', 'id_cita', c.id_cita, 'id_negocio', @id_negocio)),
       'in_app', 'enviada', NOW() - INTERVAL 5 HOUR
FROM citas c WHERE c.id_negocio = @id_negocio AND c.id_mascota = @m_luna AND c.estado = 'pendiente';

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, leida_en, fecha_creacion)
SELECT @id_propietario, @id_negocio, 'negocio', 'cita_no_confirmada', 'Cita cancelada sin confirmar',
       'Una cita se canceló porque nadie la confirmó a tiempo. Con la confirmación automática, las citas de la app quedan confirmadas al reservar.',
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'cita_no_confirmada', 'id_cita', c.id_cita, 'id_negocio', @id_negocio)),
       'in_app', 'leida', c.fecha_cancelacion + INTERVAL 2 HOUR, c.fecha_cancelacion
FROM citas c WHERE c.id_negocio = @id_negocio AND c.cancelada_por = 'sistema';

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, fecha_creacion)
VALUES (@u_guarderia, @n_guarderia, 'negocio', 'plan_limite_80', 'Te quedan pocas citas este mes',
        'Tu negocio lleva 24 de las 30 citas del mes que permite el plan Gratuito. Al llegar al límite, la app deja de mostrar horarios.',
        JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'plan_limite_80', 'id_negocio', @n_guarderia, 'mes', DATE_FORMAT(CURDATE(), '%Y-%m'))),
        'in_app', 'enviada', NOW() - INTERVAL 1 DAY);

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, leida_en, fecha_creacion)
SELECT @u_huellitas, @n_huellitas, 'negocio', 'resena_nueva', 'Nueva reseña',
       'Camilo Torres calificó con 4 estrellas Baño básico. "Muy buen baño" Puedes responderla desde el panel.',
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'resena_nueva', 'id_cita', r.id_cita, 'id_negocio', @n_huellitas, 'id_resena', r.id_resena)),
       'in_app', 'leida', r.fecha_creacion + INTERVAL 1 HOUR, r.fecha_creacion
FROM resenas r WHERE r.id_negocio = @n_huellitas;

INSERT INTO notificaciones (id_usuario, id_negocio, destino, tipo, titulo, mensaje, datos_extra_json, canal, estado, fecha_creacion)
SELECT @u_camilo, @n_huellitas, 'dueno', 'resena_respondida', 'Respondieron tu reseña',
       'Peluquería Canina Huellitas respondió tu reseña de Baño básico. Ábrela para leer la respuesta.',
       JSON_OBJECT('enlace', JSON_OBJECT('tipo', 'resena_respondida', 'id_cita', r.id_cita, 'id_negocio', @n_huellitas, 'id_resena', r.id_resena)),
       'in_app', 'enviada', r.fecha_respuesta
FROM resenas r WHERE r.id_negocio = @n_huellitas;

-- ═══════════════════════════════════════════════════════════════════════════
--  Panel P4: una semana de agenda en Patitas
--  Citas desde 3 días antes hasta 5 días después de hoy (sin domingos; el sábado
--  solo en la mañana), con dos profesionales que a veces atienden a la misma hora
--  (lado a lado en la vista Semana), pendientes con plazo para confirmar y una cita
--  fuera de disponibilidad por un bloqueo personal. Usa clientes nuevos: no cambia
--  el cumplimiento de Sofía ni los conteos que comprueban los tests del seed.
-- ═══════════════════════════════════════════════════════════════════════════

-- Paula: veterinaria sin cuenta en PetCat. Con ella Patitas llega a 3 de 3 empleados.
INSERT INTO empleados (id_negocio, id_rol, nombre, apellido, email, telefono, especialidad, fecha_vinculacion)
VALUES (@id_negocio, (SELECT id_rol FROM roles WHERE nombre = 'Veterinario' AND es_sistema = TRUE),
        'Paula', 'Rojas', 'paula@patitas.test', '3002228899', 'Cirugía y medicina interna', CURDATE() - INTERVAL 8 MONTH);
SET @e_paula = LAST_INSERT_ID();
INSERT INTO empleado_servicios (id_empleado, id_servicio) VALUES (@e_paula, @sv_consulta), (@e_paula, @sv_vacuna);

-- Lorena usa la app; Pedro no: lo registró Patitas desde el panel.
INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado, ultimo_acceso) VALUES
('Lorena', 'Gómez', 'lorena@petcat.test', @password_hash, '3001234567', 'cliente', TRUE, NOW() - INTERVAL 2 DAY);
INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado) VALUES
('Pedro', 'Díaz', 'pedro@petcat.test', @password_hash, '3009876543', 'cliente', FALSE);
SET @u_lorena = (SELECT id_usuario FROM usuarios WHERE email = 'lorena@petcat.test');
SET @u_pedro = (SELECT id_usuario FROM usuarios WHERE email = 'pedro@petcat.test');
INSERT INTO autorizaciones_datos (id_usuario, canal, id_usuario_registro, version_politica)
VALUES (@u_lorena, 'app', @u_lorena, @version);
INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica)
VALUES (@u_pedro, 'panel', @id_negocio, @id_propietario, @version);

INSERT INTO mascotas (id_usuario, nombre, especie, raza, color, fecha_nacimiento, sexo, peso, esterilizado, tiene_alergias, alergias_detalle) VALUES
(@u_lorena, 'Milo',  'perro', 'Schnauzer', 'Sal y pimienta', '2021-05-03', 'macho',  8.20, TRUE,  FALSE, NULL),
(@u_lorena, 'Nina',  'gato',  'Criolla',   'Carey',          '2023-01-20', 'hembra', 4.20, TRUE,  TRUE,  'Penicilina'),
(@u_pedro, 'Lucas', 'perro', 'Criollo',   'Negro',          '2018-09-11', 'macho', 21.00, FALSE, FALSE, NULL);
SET @m_milo  = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_lorena AND nombre = 'Milo');
SET @m_nina  = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_lorena AND nombre = 'Nina');
SET @m_lucas = (SELECT id_mascota FROM mascotas WHERE id_usuario = @u_pedro AND nombre = 'Lucas');

-- Día hábil (lunes a viernes) desde pasado mañana, para el bloqueo de Paula.
SET @dia_bloqueo = CURDATE() + INTERVAL (2 + CASE DAYOFWEEK(CURDATE() + INTERVAL 2 DAY) WHEN 7 THEN 2 WHEN 1 THEN 1 ELSE 0 END) DAY;
-- Mañanas abiertas (lunes a sábado) para las pendientes: mañana y en 3 días.
SET @p1 = CURDATE() + INTERVAL (1 + (DAYOFWEEK(CURDATE() + INTERVAL 1 DAY) = 1)) DAY;
SET @p3 = CURDATE() + INTERVAL (3 + (DAYOFWEEK(CURDATE() + INTERVAL 3 DAY) = 1)) DAY;

INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica, hora_inicio, hora_fin, motivo)
VALUES (@e_paula, 'bloqueo', @dia_bloqueo, '14:00:00', '18:00:00', 'Cita médica personal');

-- (día respecto a hoy, hora, servicio, profesional, mascota, estado si ya pasó, origen)
-- Las de hoy y las futuras quedan confirmadas.
CREATE TEMPORARY TABLE seed_agenda (
  dia INT, hora TIME, id_servicio INT, id_empleado INT, id_mascota INT, estado_pasado VARCHAR(20), origen VARCHAR(20)
);
INSERT INTO seed_agenda VALUES
(-3, '08:00:00', @sv_consulta, @id_veterinario, @m_milo,  'completada', 'app_movil'),
(-3, '10:00:00', @sv_consulta, @e_paula,        @m_lucas, 'completada', 'presencial'),
(-2, '09:00:00', @sv_vacuna,   @id_veterinario, @m_nina,  'completada', 'app_movil'),
(-2, '15:00:00', @sv_consulta, @e_paula,        @m_rocky, 'no_asistio', 'telefono'),
(-1, '08:30:00', @sv_consulta, @id_veterinario, @m_lucas, 'completada', 'telefono'),
(-1, '14:30:00', @sv_consulta, @e_paula,        @m_mia,   'completada', 'app_movil'),
( 0, '08:00:00', @sv_consulta, @id_veterinario, @m_milo,  'completada', 'app_movil'),
( 0, '08:00:00', @sv_vacuna,   @e_paula,        @m_nina,  'completada', 'app_movil'),
( 0, '10:00:00', @sv_consulta, @id_veterinario, @m_mia,   'completada', 'app_movil'),
( 0, '14:00:00', @sv_consulta, @e_paula,        @m_lucas, 'completada', 'whatsapp'),
( 1, '10:00:00', @sv_consulta, @e_paula,        @m_rocky, 'completada', 'telefono'),
( 1, '15:00:00', @sv_consulta, @id_veterinario, @m_nina,  'completada', 'app_movil'),
( 2, '09:00:00', @sv_consulta, @id_veterinario, @m_lucas, 'completada', 'presencial'),
( 3, '11:00:00', @sv_vacuna,   @id_veterinario, @m_rocky, 'completada', 'app_movil'),
( 3, '11:00:00', @sv_consulta, @e_paula,        @m_milo,  'completada', 'app_movil'),
( 4, '08:30:00', @sv_consulta, @id_veterinario, @m_milo,  'completada', 'app_movil'),
( 5, '09:00:00', @sv_consulta, @e_paula,        @m_nina,  'completada', 'app_movil');

INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, precio_final, origen, fecha_creacion)
SELECT @id_negocio, @id_sucursal, m.id_usuario, a.id_mascota, a.id_servicio, a.id_empleado, CURDATE() + INTERVAL a.dia DAY, a.hora,
       ADDTIME(a.hora, SEC_TO_TIME(s.duracion_minutos * 60)),
       IF(a.dia < 0, a.estado_pasado, 'confirmada'),
       COALESCE(IF(s.en_oferta, s.precio_oferta, NULL), s.precio_base),
       IF(a.dia < 0 AND a.estado_pasado = 'completada', COALESCE(IF(s.en_oferta, s.precio_oferta, NULL), s.precio_base), NULL),
       a.origen, TIMESTAMP(CURDATE() + INTERVAL (a.dia - 3) DAY, '18:00:00')
FROM seed_agenda a
JOIN servicios s ON s.id_servicio = a.id_servicio
JOIN mascotas m ON m.id_mascota = a.id_mascota
WHERE DAYOFWEEK(CURDATE() + INTERVAL a.dia DAY) <> 1
  AND (DAYOFWEEK(CURDATE() + INTERVAL a.dia DAY) <> 7 OR a.hora < '12:00:00');
DROP TEMPORARY TABLE seed_agenda;

-- Cae en el bloqueo de Paula: la agenda la marca fuera de disponibilidad.
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen, notas_cliente, fecha_creacion)
VALUES (@id_negocio, @id_sucursal, @u_lorena, @m_milo, @sv_consulta, @e_paula, @dia_bloqueo, '15:30:00', '16:00:00',
        'confirmada', 60000, 'app_movil', 'Control de la otitis', NOW() - INTERVAL 6 DAY);

-- Reservas de la app sin confirmar: se cancelan solas si nadie las confirma antes del plazo
-- (24 horas después de reservar o 60 minutos antes de la cita, lo que ocurra primero).
INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha, hora_inicio, hora_fin,
                   estado, precio_estimado, origen, notas_cliente, fecha_creacion) VALUES
(@id_negocio, @id_sucursal, @u_lorena,  @m_nina, @sv_vacuna,   @id_veterinario, @p1, '09:30:00', '09:45:00',
 'pendiente', 38000, 'app_movil', NULL, NOW() - INTERVAL 4 HOUR),
(@id_negocio, @id_sucursal, @u_camilo, @m_mia,  @sv_consulta, @e_paula,        @p3, '10:00:00', '10:30:00',
 'pendiente', 60000, 'app_movil', 'Vomita después de comer', NOW() - INTERVAL 1 HOUR);
UPDATE citas
SET confirmar_antes_de = LEAST(fecha_creacion + INTERVAL 24 HOUR, TIMESTAMP(fecha, hora_inicio) - INTERVAL 60 MINUTE)
WHERE id_negocio = @id_negocio AND estado = 'pendiente' AND confirmar_antes_de IS NULL;

UPDATE citas SET fecha_completada = TIMESTAMP(fecha, hora_fin) WHERE estado = 'completada' AND fecha_completada IS NULL;
UPDATE negocios n
SET total_citas = (SELECT COUNT(*) FROM citas c WHERE c.id_negocio = n.id_negocio AND c.estado = 'completada')
WHERE n.id_negocio = @id_negocio;

-- ═══════════════════════════════════════════════════════════════════════════
--  Panel P4.2: historial de las citas del seed (el detalle de la cita, B4)
--  Cada cita tiene su creación y los cambios que llevaron a su estado actual, como
--  los registra la API: la app crea pendientes (el dueño) y el negocio confirma; el
--  panel crea confirmadas. Se agregan solo los registros que faltan.
-- ═══════════════════════════════════════════════════════════════════════════

-- Las citas pasadas se reservaron unos días antes; la original reprogramada, hace dos días.
UPDATE citas SET fecha_creacion = TIMESTAMP(fecha - INTERVAL 3 DAY, '18:00:00')
WHERE fecha < CURDATE() AND fecha_creacion > TIMESTAMP(fecha - INTERVAL 3 DAY, '18:00:00');
UPDATE citas SET fecha_creacion = NOW() - INTERVAL 2 DAY WHERE estado = 'reprogramada';

-- Creación: el dueño desde la app (pendiente) o el negocio desde el panel (confirmada).
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, motivo, fecha_cambio)
SELECT c.id_cita, IF(c.origen = 'app_movil', c.id_usuario, n.id_usuario_propietario), 'estado', NULL,
       IF(c.origen = 'app_movil', 'pendiente', 'confirmada'),
       IF(c.id_cita_origen IS NULL, 'Cita creada', CONCAT('Reprogramación de la cita #', c.id_cita_origen)),
       c.fecha_creacion
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE NOT EXISTS (SELECT 1 FROM historial_citas h
                  WHERE h.id_cita = c.id_cita AND h.campo_modificado = 'estado' AND h.valor_anterior IS NULL);

-- El negocio confirmó las reservas de la app que ya no están pendientes (salvo las que
-- se cancelaron solas sin confirmar).
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
SELECT c.id_cita, n.id_usuario_propietario, 'estado', 'pendiente', 'confirmada',
       LEAST(c.fecha_creacion + INTERVAL 1 HOUR, NOW())
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.origen = 'app_movil' AND c.estado <> 'pendiente' AND NOT (c.cancelada_por <=> 'sistema')
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.valor_nuevo = 'confirmada');

-- Atención: en curso desde la hora de inicio; completada con su precio final.
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
SELECT c.id_cita, n.id_usuario_propietario, 'estado', 'confirmada', 'en_curso', TIMESTAMP(c.fecha, c.hora_inicio)
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.estado IN ('en_curso', 'completada')
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.valor_nuevo = 'en_curso');

INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
SELECT c.id_cita, n.id_usuario_propietario, 'estado', 'en_curso', 'completada', c.fecha_completada
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.estado = 'completada'
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.valor_nuevo = 'completada');

INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
SELECT c.id_cita, n.id_usuario_propietario, 'precio_final', NULL, c.precio_final, c.fecha_completada
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.estado = 'completada'
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.campo_modificado = 'precio_final');

-- Inasistencias: marcadas 15 minutos después de la hora de inicio.
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
SELECT c.id_cita, n.id_usuario_propietario, 'estado', 'confirmada', 'no_asistio',
       TIMESTAMP(c.fecha, c.hora_inicio) + INTERVAL 15 MINUTE
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.estado = 'no_asistio'
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.valor_nuevo = 'no_asistio');

-- Cancelaciones del dueño o del negocio (las del sistema ya tienen su registro).
INSERT INTO historial_citas (id_cita, id_usuario, campo_modificado, valor_anterior, valor_nuevo, motivo, fecha_cambio)
SELECT c.id_cita, IF(c.cancelada_por = 'dueno', c.id_usuario, n.id_usuario_propietario), 'estado', 'confirmada', 'cancelada',
       IF(c.cancelacion_tardia, CONCAT('Cancelación tardía', IF(c.motivo_cancelacion IS NULL, '', CONCAT(': ', c.motivo_cancelacion))),
          c.motivo_cancelacion),
       c.fecha_cancelacion
FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
WHERE c.estado = 'cancelada' AND c.cancelada_por IN ('dueno', 'negocio')
  AND NOT EXISTS (SELECT 1 FROM historial_citas h WHERE h.id_cita = c.id_cita AND h.valor_nuevo = 'cancelada');


-- Historial de peso (migración 029): los pesos de los registros médicos y, para las mascotas
-- sin ninguno, el peso actual. Igual que la migración, porque el seed carga los datos después.
INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen, id_historial)
SELECT h.id_mascota, h.peso_registro, h.fecha, 'historial', h.id_historial
FROM historial_medico h
WHERE h.peso_registro IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mascota_pesos p WHERE p.id_historial = h.id_historial);

INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen)
SELECT m.id_mascota, m.peso, DATE(m.fecha_actualizacion), 'dueno'
FROM mascotas m
WHERE m.peso IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mascota_pesos p WHERE p.id_mascota = m.id_mascota);
