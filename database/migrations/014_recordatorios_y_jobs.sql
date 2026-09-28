-- ═══════════════════════════════════════════════════════════════════════════
--  014 — Recordatorios para los jobs de la 2.4
--  - Sin canal `whatsapp` (no entra en el MVP): el canal real lo decide
--    notificar() (push o correo); `recordatorios.canal` queda como dato.
--  - Recordatorio del día anterior (`cita_dia_anterior`, a las 19:00) además
--    del de 2 horas antes. Uno de cada tipo por cita: UNIQUE (id_cita, tipo).
--  - `hito` de las vacunas (días respecto a fecha_proxima: -7, 0 o 7), uno por
--    vacuna y hito: UNIQUE (id_vacuna, hito). Los jobs se apoyan en estas
--    claves para no duplicar avisos aunque corran dos instancias.
--  - `sp_programar_recordatorios_cita`: la usan el trigger (cita que pasa a
--    confirmada) y el servicio (cita que nace confirmada). Solo programa los
--    recordatorios cuya hora aún no pasó.
--  - `whatsapp_recordatorio_h` pasa a `recordatorio_cita_h`; nueva clave
--    `recordatorio_dia_anterior_hora`.
--  - Programa los recordatorios que falten a las citas confirmadas futuras.
--  Solo borra recordatorios duplicados de una misma cita (no debería haber).
-- ═══════════════════════════════════════════════════════════════════════════

DELETE r1 FROM recordatorios r1
JOIN recordatorios r2
  ON r1.id_cita = r2.id_cita AND r1.tipo = r2.tipo AND r1.id_recordatorio > r2.id_recordatorio;

ALTER TABLE recordatorios
    MODIFY tipo ENUM('cita_confirmacion','cita_recordatorio','cita_dia_anterior','vacuna_proxima',
                     'vacuna_vencida','control_medico','alimentacion',
                     'desparasitacion','bano','medicamento','personalizado') NOT NULL,
    ADD COLUMN hito SMALLINT NULL COMMENT 'Vacunas: días respecto a fecha_proxima (-7, 0 o 7)' AFTER id_vacuna,
    ADD UNIQUE KEY uq_recordatorios_cita (id_cita, tipo),
    ADD UNIQUE KEY uq_recordatorios_vacuna (id_vacuna, hito),
    ADD INDEX idx_recordatorios_pendientes (estado, fecha_programada);

UPDATE recordatorios
SET canal = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', canal, ','), ',whatsapp,', ','))
WHERE FIND_IN_SET('whatsapp', canal);

UPDATE recordatorios SET canal = 'push' WHERE canal = '';

UPDATE configuracion_global
SET clave = 'recordatorio_cita_h', descripcion = 'Horas antes de la cita para el recordatorio'
WHERE clave = 'whatsapp_recordatorio_h';

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('recordatorio_dia_anterior_hora', '19:00', 'string', 'Hora del recordatorio del día anterior a la cita (hora de Bogotá, HH:MM)');

DROP TRIGGER IF EXISTS trg_citas_after_update;

DELIMITER $$

CREATE PROCEDURE sp_programar_recordatorios_cita(
    IN p_id_cita    INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_id_mascota INT UNSIGNED,
    IN p_fecha      DATE,
    IN p_hora       TIME
)
BEGIN
    DECLARE v_horas INT;
    DECLARE v_hora_dia_anterior TIME;
    DECLARE v_antes DATETIME;
    DECLARE v_dia_anterior DATETIME;

    SET v_horas = COALESCE(
        (SELECT CAST(valor AS UNSIGNED) FROM configuracion_global WHERE clave = 'recordatorio_cita_h'), 2);
    SET v_hora_dia_anterior = COALESCE(
        (SELECT CAST(valor AS TIME) FROM configuracion_global WHERE clave = 'recordatorio_dia_anterior_hora'), '19:00:00');
    SET v_antes = TIMESTAMP(p_fecha, p_hora) - INTERVAL v_horas HOUR;
    SET v_dia_anterior = TIMESTAMP(p_fecha - INTERVAL 1 DAY, v_hora_dia_anterior);

    IF v_dia_anterior > NOW() THEN
        INSERT INTO recordatorios (id_usuario, id_mascota, id_cita, tipo, titulo, mensaje, canal, estado, fecha_programada)
        VALUES (p_id_usuario, p_id_mascota, p_id_cita, 'cita_dia_anterior', 'Tu cita es mañana',
                CONCAT('Tu cita es mañana, ', DATE_FORMAT(p_fecha, '%d/%m/%Y'), ', a las ', TIME_FORMAT(p_hora, '%H:%i'), '.'),
                'push', 'pendiente', v_dia_anterior)
        ON DUPLICATE KEY UPDATE id_recordatorio = id_recordatorio;
    END IF;

    IF v_antes > NOW() THEN
        INSERT INTO recordatorios (id_usuario, id_mascota, id_cita, tipo, titulo, mensaje, canal, estado, fecha_programada)
        VALUES (p_id_usuario, p_id_mascota, p_id_cita, 'cita_recordatorio', 'Recordatorio de tu cita',
                CONCAT('Tu cita está programada para el ', DATE_FORMAT(p_fecha, '%d/%m/%Y'),
                       ' a las ', TIME_FORMAT(p_hora, '%H:%i'), '. ¡Te esperamos!'),
                'push', 'pendiente', v_antes)
        ON DUPLICATE KEY UPDATE id_recordatorio = id_recordatorio;
    END IF;
END$$

-- Programar los recordatorios al confirmar una cita
CREATE TRIGGER trg_citas_after_update
AFTER UPDATE ON citas
FOR EACH ROW
BEGIN
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada'
       AND NEW.recordatorio_enviado = FALSE THEN
        CALL sp_programar_recordatorios_cita(NEW.id_cita, NEW.id_usuario, NEW.id_mascota, NEW.fecha, NEW.hora_inicio);
    END IF;
END$$

-- Temporal: recordatorios que falten a las citas confirmadas futuras.
CREATE PROCEDURE tmp_014_programar_existentes()
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_id_cita, v_id_usuario, v_id_mascota INT UNSIGNED;
    DECLARE v_fecha DATE;
    DECLARE v_hora TIME;
    DECLARE cur CURSOR FOR
        SELECT id_cita, id_usuario, id_mascota, fecha, hora_inicio FROM citas
        WHERE estado = 'confirmada' AND recordatorio_enviado = FALSE AND TIMESTAMP(fecha, hora_inicio) > NOW();
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;

    OPEN cur;
    leer: LOOP
        FETCH cur INTO v_id_cita, v_id_usuario, v_id_mascota, v_fecha, v_hora;
        IF v_fin THEN LEAVE leer; END IF;
        CALL sp_programar_recordatorios_cita(v_id_cita, v_id_usuario, v_id_mascota, v_fecha, v_hora);
    END LOOP;
    CLOSE cur;
END$$

DELIMITER ;

CALL tmp_014_programar_existentes();
DROP PROCEDURE tmp_014_programar_existentes;
