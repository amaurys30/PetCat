-- ═══════════════════════════════════════════════════════════════════════════
--  026 — Agenda por profesional y profesional del registro médico
--  1. citas.ver_todas: sin ella, quien tiene citas.ver solo ve y gestiona sus
--     propias citas (las de su perfil de empleado). La tienen el Administrador
--     y la Recepcionista del sistema; el Veterinario no. Para no cambiar el
--     comportamiento de los negocios existentes, también se agrega a cada rol
--     propio que hoy tiene citas.ver.
--  2. historial_medico.asignar_profesional: registrar a nombre de otro
--     profesional (por ejemplo, al transcribir registros en papel). Solo la
--     tiene el Administrador del sistema; el propietario y el admin de la
--     plataforma pasan siempre.
--  3. historial_medico.id_usuario_registro: quién creó el registro, separado
--     del profesional que atendió (id_empleado). Los existentes quedan en NULL
--     (no se sabe). Si se elimina la cuenta, queda en NULL.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

-- Roles del sistema: se reemplaza el JSON completo, igual que en database/petcat.sql.
UPDATE roles
SET permisos_json = JSON_OBJECT(
        'citas',            JSON_ARRAY('ver', 'ver_todas', 'crear', 'editar', 'cancelar'),
        'servicios',        JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'inventario',       JSON_ARRAY('ver', 'crear', 'editar', 'eliminar', 'editar_stock'),
        'clientes',         JSON_ARRAY('ver', 'editar'),
        'empleados',        JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'pagos',            JSON_ARRAY('ver', 'ver_basico', 'reembolsar'),
        'roles',            JSON_ARRAY('ver', 'crear', 'editar', 'eliminar'),
        'reportes',         JSON_ARRAY('ver', 'exportar'),
        'configuracion',    JSON_ARRAY('ver', 'editar'),
        'historial_medico', JSON_ARRAY('ver', 'crear', 'editar', 'asignar_profesional'),
        'vacunas',          JSON_ARRAY('ver', 'crear', 'editar'),
        'resenas',          JSON_ARRAY('ver', 'responder', 'reportar')
    )
WHERE nombre = 'Administrador' AND es_sistema = TRUE AND id_negocio IS NULL;

UPDATE roles
SET permisos_json = JSON_OBJECT(
        'citas',    JSON_ARRAY('ver', 'ver_todas', 'crear', 'editar', 'cancelar'),
        'servicios', JSON_ARRAY('ver'),
        'clientes', JSON_ARRAY('ver'),
        'pagos',    JSON_ARRAY('ver_basico'),
        'resenas',  JSON_ARRAY('ver')
    )
WHERE nombre = 'Recepcionista' AND es_sistema = TRUE AND id_negocio IS NULL;

-- Roles propios con citas.ver: conservan la agenda completa.
UPDATE roles
SET permisos_json = JSON_ARRAY_APPEND(permisos_json, '$.citas', 'ver_todas')
WHERE es_sistema = FALSE
  AND JSON_CONTAINS(permisos_json, '"ver"', '$.citas')
  AND NOT JSON_CONTAINS(permisos_json, '"ver_todas"', '$.citas');

ALTER TABLE historial_medico
    ADD COLUMN id_usuario_registro INT UNSIGNED NULL
        COMMENT 'Quién creó el registro (el profesional que atendió es id_empleado)' AFTER fecha_creacion,
    ADD CONSTRAINT fk_historial_usuario_registro
        FOREIGN KEY (id_usuario_registro) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE;
