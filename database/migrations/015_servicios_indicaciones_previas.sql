-- ═══════════════════════════════════════════════════════════════════════════
--  015 — Indicaciones previas de un servicio (2.4)
--  Texto opcional del negocio para preparar la cita (ayuno, traer carnet,
--  transporte...). Se muestra en el servicio de la app y en el recordatorio del
--  día anterior (en la app y el correo; no en la push).
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE servicios
    ADD COLUMN indicaciones_previas VARCHAR(500) NULL
        COMMENT 'Preparación antes de la cita (ayuno, carnet...); va en el recordatorio del día anterior'
        AFTER descripcion;
