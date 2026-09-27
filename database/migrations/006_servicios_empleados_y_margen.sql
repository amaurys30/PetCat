-- ═══════════════════════════════════════════════════════════════════════════
--  006 — Empleados que atienden cada servicio y margen entre citas
--  - `empleado_servicios`: qué empleados atienden cada servicio. Un empleado
--    sin servicios no aparece en la agenda; un servicio que requiere cita y no
--    tiene empleados activos asignados no se puede reservar.
--  - `servicios.margen_minutos`: tiempo que ocupa la agenda del empleado
--    después de la cita (limpieza, preparación). No cambia la hora_fin de la cita.
--  Los servicios existentes quedan sin empleados asignados (el panel los
--  muestra con `sin_empleados`). No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE empleado_servicios (
    id_empleado      INT UNSIGNED    NOT NULL,
    id_servicio      INT UNSIGNED    NOT NULL,
    fecha_asignacion DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empleado, id_servicio),
    INDEX idx_empserv_servicio (id_servicio),
    CONSTRAINT fk_empserv_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_empserv_servicio
        FOREIGN KEY (id_servicio) REFERENCES servicios (id_servicio)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Empleados que atienden cada servicio (agenda y reservas)';

ALTER TABLE servicios
    ADD COLUMN margen_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 0
        COMMENT 'Minutos que ocupa la agenda del empleado después de la cita'
        AFTER duracion_minutos;
