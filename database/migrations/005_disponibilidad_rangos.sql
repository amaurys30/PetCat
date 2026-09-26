-- ═══════════════════════════════════════════════════════════════════════════
--  005 — Rangos de fechas en disponibilidad_empleado
--  - `fecha_fin`: último día de un bloqueo o una vacación de varios días
--    (`fecha_especifica` es el primero). NULL = solo `fecha_especifica`.
--  - Llave foránea de `id_sucursal` (antes no tenía). NULL = cualquier
--    sucursal del negocio.
--
--  Antes de aplicarla, comprobar que no haya filas con una sucursal que no
--  existe; si las hay, la migración falla:
--    SELECT d.id_disponibilidad FROM disponibilidad_empleado d
--    LEFT JOIN sucursales s ON s.id_sucursal = d.id_sucursal
--    WHERE d.id_sucursal IS NOT NULL AND s.id_sucursal IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE disponibilidad_empleado
    ADD COLUMN fecha_fin DATE NULL
        COMMENT 'Último día de un bloqueo o vacación de varios días; NULL = solo fecha_especifica'
        AFTER fecha_especifica,
    ADD INDEX idx_disponibilidad_sucursal (id_sucursal),
    ADD CONSTRAINT fk_disponibilidad_sucursal
        FOREIGN KEY (id_sucursal) REFERENCES sucursales (id_sucursal)
        ON DELETE CASCADE ON UPDATE CASCADE;
