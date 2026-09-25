-- ═══════════════════════════════════════════════════════════════════════════
--  002 — Horario partido en horarios_negocio
--  Permite varios rangos por día en una sucursal (p. ej. 08:00–12:00 y
--  14:00–18:00). El backend valida que los rangos de un mismo día no se crucen.
--  Se aplica sobre la base ya creada (no crea ni borra datos).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE horarios_negocio
    DROP INDEX uq_horario_sucursal_dia,
    ADD INDEX idx_horarios_sucursal_dia (id_sucursal, dia_semana),
    COMMENT = 'Horarios de atención por sucursal: uno o varios rangos por día';
