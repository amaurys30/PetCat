-- ═══════════════════════════════════════════════════════════════════════════
--  009 — Cancelaciones e inasistencias de citas
--  - Quién canceló (dueño o negocio), cuándo, y si fue una cancelación tardía
--    del dueño (a menos de antelacion_cancelacion_app_h horas de la cita).
--  - Índice (id_negocio, id_usuario, estado) para contar por cliente y negocio
--    las inasistencias (no_asistio), cancelaciones y citas completadas sin un
--    contador guardado que se pueda desincronizar.
--  No borra datos: las citas canceladas antes quedan con cancelada_por NULL.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE citas
    ADD COLUMN cancelada_por ENUM('dueno','negocio') NULL AFTER motivo_cancelacion,
    ADD COLUMN fecha_cancelacion DATETIME NULL AFTER cancelada_por,
    ADD COLUMN cancelacion_tardia BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'El dueño canceló a menos de antelacion_cancelacion_app_h horas'
        AFTER fecha_cancelacion,
    ADD INDEX idx_citas_negocio_usuario_estado (id_negocio, id_usuario, estado);
