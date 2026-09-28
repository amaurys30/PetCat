-- ═══════════════════════════════════════════════════════════════════════════
--  007 — Configuración de la agenda y autorizaciones de tratamiento de datos
--  - Claves de configuracion_global para reservar citas (cuadrícula,
--    antelación, horizonte, cancelación desde la app) y el enlace a la
--    política de datos que va en el correo de bienvenida.
--  - `autorizaciones_datos`: prueba de la autorización del titular para el
--    tratamiento de sus datos (Ley 1581 de 2012, Decreto 1377 de 2013), una
--    fila por autorización: registro en la app o registro por un negocio.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('intervalo_agenda_min',          '15', 'integer', 'Cuadrícula de horarios de la agenda (minutos)'),
('antelacion_minima_reserva_min', '60', 'integer', 'Minutos mínimos de anticipación para reservar desde la app'),
('horizonte_reserva_dias',        '60', 'integer', 'Días hacia adelante en que se puede reservar'),
('antelacion_cancelacion_app_h',  '2',  'integer', 'Horas antes de la cita hasta las que el dueño cancela o reprograma desde la app'),
('politica_datos_url',            '',   'string',  'URL de la política de tratamiento de datos (correo de bienvenida)');

CREATE TABLE autorizaciones_datos (
    id_autorizacion     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario          INT UNSIGNED    NOT NULL COMMENT 'Titular de los datos',
    canal               ENUM('app','panel') NOT NULL,
    id_negocio          INT UNSIGNED    NULL COMMENT 'Negocio que registró al cliente (canal panel)',
    id_usuario_registro INT UNSIGNED    NULL COMMENT 'Quién registró la autorización (el titular en la app; propietario o empleado en el panel)',
    version_politica    VARCHAR(20)     NOT NULL COMMENT 'configuracion_global.terminos_version vigente',
    fecha_autorizacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address          VARCHAR(45)     NULL,
    revocada_en         DATETIME        NULL,
    PRIMARY KEY (id_autorizacion),
    INDEX idx_autorizaciones_usuario (id_usuario),
    INDEX idx_autorizaciones_negocio (id_negocio),
    CONSTRAINT fk_autorizaciones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_autorizaciones_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_autorizaciones_registro
        FOREIGN KEY (id_usuario_registro) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Autorizaciones de tratamiento de datos personales (Ley 1581 de 2012)';
