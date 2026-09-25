-- ═══════════════════════════════════════════════════════════════════════════
--  001 — Empleados únicos por negocio
--  - El email de un empleado es único dentro de su negocio (no global): la
--    misma persona puede trabajar en varios negocios.
--  - Un usuario solo puede estar vinculado una vez a cada negocio.
--  Los NULL no chocan: puede haber varios empleados sin email o sin cuenta.
--  La comparación de email no distingue mayúsculas (collation de la columna).
--
--  Antes de aplicarla, comprobar que no haya duplicados con la consulta que
--  acompaña la entrega; si los hay, la migración falla.
--  Es independiente de 002 y 003: se puede aplicar después de ellas.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE empleados
    ADD UNIQUE KEY uq_empleados_negocio_email (id_negocio, email),
    ADD UNIQUE KEY uq_empleados_negocio_usuario (id_negocio, id_usuario);
