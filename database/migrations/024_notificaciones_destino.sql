-- ═══════════════════════════════════════════════════════════════════════════
--  024 — A quién va cada notificación: al dueño de la mascota o al negocio
--  Un mismo usuario puede ser dueño de mascotas y personal de un negocio, y
--  recibe las dos clases de avisos en la misma lista. `destino` las separa: la
--  app muestra las del dueño y el panel las del negocio (con su propio contador).
--  Se guarda al crear la notificación con el rol del destinatario.
--  Las existentes se completan así: los tipos que solo recibe el dueño, 'dueno';
--  los que van a las dos partes (cancelada, reprogramada, no confirmada), 'dueno'
--  si el usuario es el dueño de la mascota de la cita y no el propietario del
--  negocio (el propietario recibe la versión del negocio); el resto, 'negocio'.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE notificaciones
    ADD COLUMN destino ENUM('dueno','negocio') NOT NULL DEFAULT 'negocio'
        COMMENT 'dueno = app del dueño de la mascota; negocio = panel' AFTER id_negocio;

UPDATE notificaciones
SET destino = 'dueno'
WHERE tipo IN ('cita_agendada', 'cita_confirmada', 'cita_dia_anterior', 'cita_recordatorio',
               'resena_invitacion', 'resena_respondida', 'vacuna_proxima', 'vacuna_vence_hoy', 'vacuna_vencida');

UPDATE notificaciones n
JOIN citas c ON c.id_cita = CAST(JSON_UNQUOTE(JSON_EXTRACT(n.datos_extra_json, '$.enlace.id_cita')) AS UNSIGNED)
JOIN mascotas m ON m.id_mascota = c.id_mascota
JOIN negocios ng ON ng.id_negocio = c.id_negocio
SET n.destino = 'dueno'
WHERE n.tipo IN ('cita_cancelada', 'cita_reprogramada', 'cita_no_confirmada')
  AND m.id_usuario = n.id_usuario
  AND ng.id_usuario_propietario <> n.id_usuario;

-- Sin valor por defecto: el código siempre lo indica.
ALTER TABLE notificaciones
    MODIFY COLUMN destino ENUM('dueno','negocio') NOT NULL
        COMMENT 'dueno = app del dueño de la mascota; negocio = panel',
    -- Listar y contar las no leídas de un destino (la campana del panel).
    ADD INDEX idx_notif_usuario_destino (id_usuario, destino, estado, fecha_creacion);
