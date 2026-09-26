-- ═══════════════════════════════════════════════════════════════════════════
--  Reparar tildes dañadas en bases creadas por docker compose antes del arreglo
--  de codificación (SET NAMES utf8mb4 en petcat.sql y dev_seed.sql).
--
--  Al crear el volumen, compose cargaba petcat.sql con el cliente mysql en latin1:
--  el texto con tildes de los datos iniciales y del trigger de citas quedó
--  codificado dos veces ("Vacunación" -> "VacunaciÃ³n"). Los datos creados
--  por la API no están afectados.
--
--  NO es una migración: una base nueva no lo necesita. Se ejecuta una sola vez
--  en cada base afectada. Es seguro repetirlo: solo cambia filas que todavía
--  tienen la secuencia dañada (bytes de "Ã" o "Â") y vuelve a crear el trigger.
--  Las bases sin datos propios se pueden recrear con npm run db:reset -- --yes.
--  Los COMMENT de tablas y columnas también quedaron dañados; son solo
--  documentación y no se corrigen aquí.
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- Datos iniciales de database/petcat.sql
UPDATE planes_suscripcion
   SET nombre = CONVERT(CAST(CONVERT(nombre USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(nombre) REGEXP '^(..)*C38[23]';
UPDATE planes_suscripcion
   SET descripcion = CONVERT(CAST(CONVERT(descripcion USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(descripcion) REGEXP '^(..)*C38[23]';
UPDATE roles
   SET nombre = CONVERT(CAST(CONVERT(nombre USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(nombre) REGEXP '^(..)*C38[23]' AND es_sistema = TRUE;
UPDATE roles
   SET descripcion = CONVERT(CAST(CONVERT(descripcion USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(descripcion) REGEXP '^(..)*C38[23]' AND es_sistema = TRUE;
UPDATE categorias_servicio
   SET nombre = CONVERT(CAST(CONVERT(nombre USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(nombre) REGEXP '^(..)*C38[23]';
UPDATE categorias_servicio
   SET descripcion = CONVERT(CAST(CONVERT(descripcion USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(descripcion) REGEXP '^(..)*C38[23]';
UPDATE categorias_producto
   SET nombre = CONVERT(CAST(CONVERT(nombre USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(nombre) REGEXP '^(..)*C38[23]';
UPDATE categorias_producto
   SET descripcion = CONVERT(CAST(CONVERT(descripcion USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(descripcion) REGEXP '^(..)*C38[23]';
UPDATE configuracion_global
   SET valor = CONVERT(CAST(CONVERT(valor USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(valor) REGEXP '^(..)*C38[23]';
UPDATE configuracion_global
   SET descripcion = CONVERT(CAST(CONVERT(descripcion USING latin1) AS BINARY) USING utf8mb4)
 WHERE HEX(descripcion) REGEXP '^(..)*C38[23]';

-- El mensaje del recordatorio del trigger de citas tenía "está" y "¡Te esperamos!".
DROP TRIGGER IF EXISTS trg_citas_after_update;

DELIMITER $$

-- Generar recordatorio automático al confirmar una cita
CREATE TRIGGER trg_citas_after_update
AFTER UPDATE ON citas
FOR EACH ROW
BEGIN
    -- Si la cita pasa a confirmada, crear recordatorio automático
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada'
       AND NEW.recordatorio_enviado = FALSE THEN
        INSERT INTO recordatorios (
            id_usuario, id_mascota, id_cita, tipo,
            titulo, mensaje, canal, estado, fecha_programada
        ) VALUES (
            NEW.id_usuario, NEW.id_mascota, NEW.id_cita,
            'cita_recordatorio',
            'Recordatorio de tu cita',
            CONCAT('Tu cita está programada para el ', DATE_FORMAT(NEW.fecha, '%d/%m/%Y'),
                   ' a las ', TIME_FORMAT(NEW.hora_inicio, '%H:%i'), '. ¡Te esperamos!'),
            'push,whatsapp',
            'pendiente',
            DATE_SUB(CONCAT(NEW.fecha, ' ', NEW.hora_inicio), INTERVAL 2 HOUR)
        );
    END IF;
END$$

DELIMITER ;
