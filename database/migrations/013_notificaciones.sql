-- ═══════════════════════════════════════════════════════════════════════════
--  013 — Notificaciones: dispositivos, envíos y horario de silencio (2.3)
--  - `dispositivos`: tokens de Expo Push de la app, ligados a la sesión en que
--    se registraron (cerrar la sesión desactiva el dispositivo).
--  - `notificaciones_envios`: cada entrega de una notificación por push (una
--    fila por dispositivo) o por correo, con su programación (horario de
--    silencio), reintentos y el ticket de Expo para revisar el recibo. Se
--    escriben en la misma transacción que la notificación y se envían después
--    del commit (outbox).
--  - Índice para listar las notificaciones de un usuario y contar las no leídas.
--  - `silencio_inicio` y `silencio_fin` en configuracion_global.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE dispositivos (
    id_dispositivo      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario          INT UNSIGNED    NOT NULL,
    id_sesion           BIGINT UNSIGNED NULL COMMENT 'Sesión en la que se registró; al cerrarla se desactiva',
    token_expo          VARCHAR(255)    NOT NULL COMMENT 'ExponentPushToken[...]',
    plataforma          ENUM('ios','android') NOT NULL,
    nombre              VARCHAR(100)    NULL COMMENT 'Modelo del teléfono, para mostrarlo al usuario',
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    ultimo_error        VARCHAR(255)    NULL COMMENT 'Último error de Expo (p. ej. DeviceNotRegistered)',
    fecha_registro      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_dispositivo),
    UNIQUE KEY uq_dispositivos_token (token_expo),
    INDEX idx_dispositivos_usuario (id_usuario, activo),
    INDEX idx_dispositivos_sesion (id_sesion),
    CONSTRAINT fk_dispositivos_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dispositivos_sesion
        FOREIGN KEY (id_sesion) REFERENCES sesiones (id_sesion)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dispositivos de la app con su token de Expo Push';

CREATE TABLE notificaciones_envios (
    id_envio            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_notificacion     BIGINT UNSIGNED NOT NULL,
    canal               ENUM('push','email') NOT NULL,
    id_dispositivo      BIGINT UNSIGNED NULL COMMENT 'Solo push: una fila por dispositivo',
    estado              ENUM('pendiente','enviado','fallido','omitido') NOT NULL DEFAULT 'pendiente',
    programado_para     DATETIME        NOT NULL COMMENT 'Ahora, o el fin del horario de silencio',
    intentos            TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ticket_expo         VARCHAR(100)    NULL COMMENT 'Ticket de Expo para revisar el recibo',
    recibo_pendiente    BOOLEAN         NOT NULL DEFAULT FALSE,
    error               VARCHAR(500)    NULL,
    fecha_envio         DATETIME        NULL,
    fecha_creacion      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_envio),
    INDEX idx_envios_pendientes (estado, programado_para),
    INDEX idx_envios_recibos (recibo_pendiente, fecha_envio),
    INDEX idx_envios_notificacion (id_notificacion),
    CONSTRAINT fk_envios_notificacion
        FOREIGN KEY (id_notificacion) REFERENCES notificaciones (id_notificacion)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_envios_dispositivo
        FOREIGN KEY (id_dispositivo) REFERENCES dispositivos (id_dispositivo)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Entregas de notificaciones por push y correo (outbox)';

ALTER TABLE notificaciones ADD INDEX idx_notif_usuario_estado (id_usuario, estado, fecha_creacion);

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('silencio_inicio', '21:00', 'string', 'Inicio del horario de silencio de push y correos no urgentes (hora de Bogotá, HH:MM)'),
('silencio_fin',    '07:00', 'string', 'Fin del horario de silencio (HH:MM); igual al inicio = sin silencio');
