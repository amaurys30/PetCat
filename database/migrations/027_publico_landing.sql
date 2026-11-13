-- ═══════════════════════════════════════════════════════════════════════════
--  027 — Página pública de presentación (landing)
--  - `publico_umbral_cifras` (5): cada cifra agregada de la landing (negocios
--    activos, ciudades y citas atendidas) se muestra solo si lo supera.
--  - `publico_min_resenas` (3): reseñas elegibles mínimas para mostrar la
--    sección de reseñas de la landing; con menos, no se muestra.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('publico_umbral_cifras', '5', 'integer', 'Landing: una cifra (negocios activos, ciudades, citas atendidas) se muestra solo si supera este valor'),
('publico_min_resenas',   '3', 'integer', 'Landing: reseñas elegibles mínimas (4 y 5 estrellas con comentario) para mostrar la sección de reseñas');
