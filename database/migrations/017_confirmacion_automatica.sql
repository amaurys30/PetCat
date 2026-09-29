-- ═══════════════════════════════════════════════════════════════════════════
--  017 — Confirmación y cancelación automáticas de citas (2.5)
--  - `negocios.confirmacion_automatica`: las citas de la app nacen confirmadas.
--  - `citas.confirmar_antes_de`: plazo del negocio para confirmar una cita
--    pendiente (se calcula al crearla); al vencer, el job la cancela.
--  - `citas.aviso_por_confirmar_en`: cuándo salió el aviso de mitad de plazo
--    (NULL = no ha salido); deduplica ese aviso.
--  - `cancelada_por = 'sistema'`: la cancelación automática.
--  - `plazo_confirmacion_h` y `confirmacion_antes_inicio_min` en configuracion_global.
--  - Las pendientes futuras reciben un plazo contado desde ahora (sin el ajuste
--    del horario de silencio); las que empiezan en menos de 60 minutos o ya
--    empezaron quedan sin plazo y no se cancelan solas.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE negocios
    ADD COLUMN confirmacion_automatica BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Las citas de la app nacen confirmadas'
        AFTER activo;

ALTER TABLE citas
    MODIFY cancelada_por ENUM('dueno','negocio','sistema') NULL,
    ADD COLUMN confirmar_antes_de DATETIME NULL
        COMMENT 'Plazo para confirmar una cita pendiente; al vencer se cancela sola'
        AFTER cancelacion_tardia,
    ADD COLUMN aviso_por_confirmar_en DATETIME NULL
        COMMENT 'Cuándo se avisó al negocio a mitad del plazo (NULL = no se ha avisado)'
        AFTER confirmar_antes_de,
    ADD INDEX idx_citas_por_confirmar (estado, confirmar_antes_de);

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('plazo_confirmacion_h',          '24', 'integer', 'Horas que tiene el negocio para confirmar una cita pendiente'),
('confirmacion_antes_inicio_min', '60', 'integer', 'La cita pendiente se cancela a más tardar estos minutos antes de su inicio');

UPDATE citas
SET confirmar_antes_de = LEAST(NOW() + INTERVAL 24 HOUR, TIMESTAMP(fecha, hora_inicio) - INTERVAL 60 MINUTE)
WHERE estado = 'pendiente' AND TIMESTAMP(fecha, hora_inicio) - INTERVAL 60 MINUTE > NOW();
