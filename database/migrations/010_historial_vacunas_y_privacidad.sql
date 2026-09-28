-- ═══════════════════════════════════════════════════════════════════════════
--  010 — Historial médico, vacunas y privacidad
--  - mascotas.compartir_historial (por defecto TRUE): si el dueño lo desactiva,
--    cada negocio ve solo el historial clínico que él creó. Las vacunas, las
--    alergias y las condiciones médicas siguen visibles para cualquier negocio
--    con una cita válida.
--  - vacunas.registrada_por (dueno o negocio) e id_usuario_registro: las vacunas
--    que registra el dueño quedan marcadas para que el veterinario las distinga.
--    Las existentes sin negocio se marcan como del dueño.
--  - Llave foránea de historial_medico.id_cita (antes solo tenía índice).
--  - configuracion_global.dias_aviso_vacuna: una vacuna es "próxima" desde 30
--    días antes de fecha_proxima.
--
--  Antes de aplicarla, comprobar que no haya historial con citas inexistentes;
--  si hay filas, la llave foránea falla:
--    SELECT h.id_historial, h.id_cita FROM historial_medico h
--    LEFT JOIN citas c ON c.id_cita = h.id_cita
--    WHERE h.id_cita IS NOT NULL AND c.id_cita IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE mascotas
    ADD COLUMN compartir_historial BOOLEAN NOT NULL DEFAULT TRUE
        COMMENT 'FALSE: cada negocio ve solo el historial clínico que creó'
        AFTER condiciones_medicas;

ALTER TABLE vacunas
    ADD COLUMN registrada_por ENUM('dueno','negocio') NOT NULL DEFAULT 'negocio' AFTER id_negocio,
    ADD COLUMN id_usuario_registro INT UNSIGNED NULL AFTER registrada_por,
    ADD CONSTRAINT fk_vacunas_usuario_registro
        FOREIGN KEY (id_usuario_registro) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE vacunas SET registrada_por = 'dueno' WHERE id_negocio IS NULL;

ALTER TABLE historial_medico
    ADD CONSTRAINT fk_historial_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('dias_aviso_vacuna', '30', 'integer', 'Días antes de fecha_proxima en que una vacuna cuenta como próxima');
