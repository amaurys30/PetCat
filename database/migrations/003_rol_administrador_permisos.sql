-- ═══════════════════════════════════════════════════════════════════════════
--  003 — Rol del sistema "Administrador" con el catálogo completo de permisos
--  Antes no tenía historial_medico ni vacunas, e inventario no incluía
--  editar_stock. Debe coincidir con CATALOGO_PERMISOS de
--  backend/src/shared/utils/permissions.js.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE roles
SET permisos_json = JSON_OBJECT(
        'citas',            JSON_ARRAY('ver', 'crear', 'editar', 'cancelar'),
        'servicios',        JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'inventario',       JSON_ARRAY('ver', 'crear', 'editar', 'eliminar', 'editar_stock'),
        'clientes',         JSON_ARRAY('ver', 'editar'),
        'empleados',        JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'pagos',            JSON_ARRAY('ver', 'ver_basico', 'reembolsar'),
        'roles',            JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'reportes',         JSON_ARRAY('ver', 'exportar'),
        'configuracion',    JSON_ARRAY('ver', 'editar'),
        'historial_medico', JSON_ARRAY('ver', 'crear', 'editar'),
        'vacunas',          JSON_ARRAY('ver', 'crear', 'editar')
    )
WHERE nombre = 'Administrador' AND es_sistema = TRUE AND id_negocio IS NULL;
