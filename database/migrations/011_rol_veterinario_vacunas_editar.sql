-- ═══════════════════════════════════════════════════════════════════════════
--  011 — Rol del sistema "Veterinario": vacunas.editar
--  El veterinario podía registrar vacunas pero no corregirlas. Con esta
--  migración historial_medico y vacunas tienen las mismas acciones
--  (ver, crear, editar). El resto de permisos del rol no cambia.
--  Los roles del sistema no se editan desde la API, así que se reemplaza el
--  JSON completo, igual que en database/petcat.sql.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE roles
SET permisos_json = JSON_OBJECT(
        'citas',            JSON_ARRAY('ver', 'crear', 'editar'),
        'servicios',        JSON_ARRAY('ver'),
        'inventario',       JSON_ARRAY('ver', 'editar_stock'),
        'clientes',         JSON_ARRAY('ver'),
        'historial_medico', JSON_ARRAY('ver', 'crear', 'editar'),
        'vacunas',          JSON_ARRAY('ver', 'crear', 'editar')
    )
WHERE nombre = 'Veterinario' AND es_sistema = TRUE AND id_negocio IS NULL;
