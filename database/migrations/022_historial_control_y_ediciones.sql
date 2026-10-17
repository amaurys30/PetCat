-- ═══════════════════════════════════════════════════════════════════════════
--  022 — Registros médicos: tipo "control" y rastro de ediciones
--  - historial_medico.tipo admite 'control' (seguimiento de un tratamiento o de
--    una condición, distinto de una consulta).
--  - Los registros médicos no se borran: cada edición deja constancia. En el
--    registro, la última (fecha_edicion e id_usuario_edicion, que muestra la
--    ficha); en historial_medico_ediciones, todas, con los campos que cambiaron
--    y sus valores anteriores. El editor queda NULL si su cuenta se elimina; las
--    ediciones se borran con el registro (solo si se borra la mascota).
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE historial_medico
    MODIFY COLUMN tipo ENUM('consulta_general','control','cirugia','vacunacion','examen_laboratorio',
                            'radiografia','ecografia','hospitalizacion','urgencia',
                            'desparasitacion','otro') NOT NULL,
    ADD COLUMN fecha_edicion      DATETIME     NULL COMMENT 'Última edición' AFTER fecha_creacion,
    ADD COLUMN id_usuario_edicion INT UNSIGNED NULL COMMENT 'Quién hizo la última edición' AFTER fecha_edicion,
    ADD CONSTRAINT fk_historial_usuario_edicion
        FOREIGN KEY (id_usuario_edicion) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE historial_medico_ediciones (
    id_edicion         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_historial       BIGINT UNSIGNED NOT NULL,
    id_usuario         INT UNSIGNED    NULL,
    campos             JSON            NOT NULL COMMENT 'Campos que cambiaron',
    valores_anteriores JSON            NOT NULL COMMENT 'Valor de cada campo antes de la edición',
    fecha              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_edicion),
    INDEX idx_historial_ediciones_registro (id_historial, fecha),
    CONSTRAINT fk_historial_ediciones_registro
        FOREIGN KEY (id_historial) REFERENCES historial_medico (id_historial)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_historial_ediciones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada edición de un registro médico: quién, cuándo, qué campos y sus valores anteriores';
