-- ═══════════════════════════════════════════════════════════════════════════
--  020 — Canal panel_web en las autorizaciones de datos
--  - panel_web: el titular se registró él mismo en el panel web
--               (POST /auth/register con canal panel_web; sin negocio).
--  - panel sigue significando solo "un negocio registró a un tercero" y tomó
--    su autorización (con id_negocio).
--  Pasa a panel_web las filas panel que guardó el registro propio antes de esta
--  migración: sin negocio y registradas por el propio titular. Una autorización
--  de un negocio que se borró también queda sin negocio, pero la registró otra
--  persona (propietario o empleado), así que no cambia.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE autorizaciones_datos
    MODIFY COLUMN canal ENUM('app','panel','panel_web','invitacion','aceptacion') NOT NULL;

UPDATE autorizaciones_datos
SET canal = 'panel_web'
WHERE canal = 'panel' AND id_negocio IS NULL AND id_usuario_registro = id_usuario;
