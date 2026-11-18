-- ═══════════════════════════════════════════════════════════════════════════
--  028 — Códigos de 6 dígitos en los correos de verificación y recuperación
--  La app móvil no puede abrir los enlaces del correo (apuntan al panel web): el
--  mismo correo lleva un código que se escribe en la app.
--  - `codigo_hash`: HMAC-SHA256 del código con CODIGO_SECRET (nunca el código).
--  - Vigente 15 minutos, máximo 5 intentos; cada código nuevo cierra el anterior,
--    y usar el código o el enlace cierra los dos.
--  - Las filas se conservan: con ellas se limita cuántos correos se envían a la
--    misma cuenta (1 por minuto y 5 por hora).
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE codigos_correo (
    id_codigo       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario      INT UNSIGNED    NOT NULL,
    tipo            ENUM('verificacion','recuperacion') NOT NULL,
    codigo_hash     CHAR(64)        NOT NULL COMMENT 'HMAC-SHA256 con CODIGO_SECRET, en hexadecimal',
    expira          DATETIME        NOT NULL,
    intentos        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Intentos fallidos',
    cerrado_en      DATETIME        NULL COMMENT 'Ya no sirve: usado, reemplazado, por intentos o por usar el enlace',
    motivo_cierre   ENUM('usado','reemplazado','intentos','enlace') NULL,
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_codigo),
    INDEX idx_codigos_usuario_tipo (id_usuario, tipo, fecha_creacion),
    CONSTRAINT fk_codigos_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Códigos de 6 dígitos de los correos de verificación y recuperación';
