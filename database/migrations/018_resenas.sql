-- ═══════════════════════════════════════════════════════════════════════════
--  018 — Reseñas (2.6)
--  - `citas.fecha_completada`: cuándo pasó a completada. De ahí salen la
--    invitación a reseñar y el plazo para hacerlo. Las completadas existentes
--    la toman de historial_citas o, si no está, de fecha + hora_fin.
--  - En `resenas`: fechas de edición de la reseña y de la respuesta, retiro por
--    el autor (`retirada_en`), datos del reporte (motivo, detalle, fecha, quién)
--    y `cliente_registrado_por_negocio`, señal para la moderación del super
--    admin (Fase 4): el autor tiene una autorización de datos con canal panel
--    de ese negocio. Nunca sale en lo público ni en el panel del negocio.
--  - CHECK de 1 a 5 en las calificaciones por aspecto.
--  - Índice (id_negocio, visible, fecha_creacion) para el listado público; reemplaza
--    a idx_resenas_negocio (le sirve a la llave foránea) y a idx_resenas_visible.
--  - Triggers: COALESCE(AVG, 0) para que ocultar la última reseña visible no
--    intente guardar NULL en negocios.calificacion_promedio (NOT NULL), y el de
--    UPDATE solo recalcula si cambian calificacion o visible.
--  - `recordatorios.tipo` suma 'resena_invitacion' (uno por cita por
--    uq_recordatorios_cita).
--  - `resena_plazo_dias` (30) y `resena_invitacion_h` (3) en configuracion_global.
--  - Módulo de permisos `resenas` (ver, responder, reportar) en los roles del
--    sistema: Administrador con todo; Veterinario y Recepcionista con ver.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE citas
    ADD COLUMN fecha_completada DATETIME NULL
        COMMENT 'Cuándo pasó a completada: invitación y plazo para reseñar'
        AFTER aviso_por_confirmar_en;

UPDATE citas c
SET c.fecha_completada = COALESCE(
        (SELECT MAX(h.fecha_cambio) FROM historial_citas h
         WHERE h.id_cita = c.id_cita AND h.campo_modificado = 'estado' AND h.valor_nuevo = 'completada'),
        TIMESTAMP(c.fecha, c.hora_fin))
WHERE c.estado = 'completada';

ALTER TABLE resenas
    ADD COLUMN fecha_edicion DATETIME NULL
        COMMENT 'Última edición del autor'
        AFTER fecha_creacion,
    ADD COLUMN retirada_en DATETIME NULL
        COMMENT 'El autor la retiró (visible = FALSE); no puede reseñar de nuevo esa cita'
        AFTER fecha_edicion,
    ADD COLUMN fecha_edicion_respuesta DATETIME NULL
        COMMENT 'Última edición de la respuesta (fecha_respuesta es la primera)'
        AFTER fecha_respuesta,
    ADD COLUMN motivo_reporte ENUM('lenguaje_ofensivo','datos_personales','no_relacionada','spam','otro') NULL
        AFTER reportada,
    ADD COLUMN detalle_reporte VARCHAR(500) NULL
        AFTER motivo_reporte,
    ADD COLUMN fecha_reporte DATETIME NULL
        AFTER detalle_reporte,
    ADD COLUMN id_usuario_reporta INT UNSIGNED NULL
        COMMENT 'Quién del negocio la reportó'
        AFTER fecha_reporte,
    ADD COLUMN cliente_registrado_por_negocio BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'El autor tiene una autorización de datos con canal panel de este negocio. Solo para el super admin'
        AFTER id_usuario_reporta,
    DROP INDEX idx_resenas_visible,
    DROP INDEX idx_resenas_negocio,
    ADD INDEX idx_resenas_negocio_visible (id_negocio, visible, fecha_creacion),
    ADD CONSTRAINT fk_resenas_reporta
        FOREIGN KEY (id_usuario_reporta) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT chk_resenas_calif_atencion CHECK (calif_atencion BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_resenas_calif_precio CHECK (calif_precio BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_resenas_calif_instalaciones CHECK (calif_instalaciones BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_resenas_calif_puntualidad CHECK (calif_puntualidad BETWEEN 1 AND 5);

DROP TRIGGER IF EXISTS trg_resenas_after_insert;
DROP TRIGGER IF EXISTS trg_resenas_after_update;

DELIMITER $$

-- Calificación promedio y total de reseñas visibles del negocio al agregar una reseña.
CREATE TRIGGER trg_resenas_after_insert
AFTER INSERT ON resenas
FOR EACH ROW
BEGIN
    UPDATE negocios
    SET calificacion_promedio = COALESCE((
            SELECT ROUND(AVG(calificacion), 2)
            FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        ), 0),
        total_resenas = (
            SELECT COUNT(*) FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        )
    WHERE id_negocio = NEW.id_negocio;
END$$

-- Igual al editar la calificación o cambiar la visibilidad (retiro del autor o
-- moderación). No hay trigger de DELETE: las reseñas no se borran.
CREATE TRIGGER trg_resenas_after_update
AFTER UPDATE ON resenas
FOR EACH ROW
BEGIN
    IF NEW.calificacion <> OLD.calificacion OR NEW.visible <> OLD.visible THEN
        UPDATE negocios
        SET calificacion_promedio = COALESCE((
                SELECT ROUND(AVG(calificacion), 2)
                FROM resenas
                WHERE id_negocio = NEW.id_negocio AND visible = TRUE
            ), 0),
            total_resenas = (
                SELECT COUNT(*) FROM resenas
                WHERE id_negocio = NEW.id_negocio AND visible = TRUE
            )
        WHERE id_negocio = NEW.id_negocio;
    END IF;
END$$

DELIMITER ;

UPDATE resenas r
SET r.cliente_registrado_por_negocio = EXISTS (
        SELECT 1 FROM autorizaciones_datos a
        WHERE a.id_usuario = r.id_usuario AND a.canal = 'panel' AND a.id_negocio = r.id_negocio);

ALTER TABLE recordatorios
    MODIFY tipo ENUM('cita_confirmacion','cita_recordatorio','cita_dia_anterior','resena_invitacion',
                     'vacuna_proxima','vacuna_vencida','control_medico','alimentacion',
                     'desparasitacion','bano','medicamento','personalizado') NOT NULL;

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('resena_plazo_dias',   '30', 'integer', 'Días desde que se completa la cita en que el dueño puede reseñarla o editar su reseña'),
('resena_invitacion_h', '3',  'integer', 'Horas después de completada la cita para invitar a reseñar (entre las 20:00 y las 10:00 se corre a las 10:00)');

-- Los roles del sistema no se editan desde la API. Los roles propios de cada
-- negocio no reciben el módulo: lo asigna quien administra los roles.
UPDATE roles
SET permisos_json = JSON_SET(permisos_json, '$.resenas', JSON_ARRAY('ver', 'responder', 'reportar'))
WHERE nombre = 'Administrador' AND es_sistema = TRUE AND id_negocio IS NULL;

UPDATE roles
SET permisos_json = JSON_SET(permisos_json, '$.resenas', JSON_ARRAY('ver'))
WHERE nombre IN ('Veterinario', 'Recepcionista') AND es_sistema = TRUE AND id_negocio IS NULL;
