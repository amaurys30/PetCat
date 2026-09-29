-- ═══════════════════════════════════════════════════════════════════════════
--  012 — Registro de archivos subidos a Cloudinary (2.2)
--  - `archivos`: una fila por archivo subido (fotos, logos, banners,
--    comprobantes de vacunas y archivos del historial) con su public_id, a
--    qué registro pertenece, quién lo subió y su estado. Permite borrar el
--    archivo anterior al reemplazar una imagen, reintentar borrados fallidos
--    y dar URLs firmadas a los archivos privados.
--  Las columnas *_url existentes se mantienen. No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE archivos (
    id_archivo          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    public_id           VARCHAR(255)     NOT NULL COMMENT 'Identificador en Cloudinary (aleatorio, con la carpeta)',
    tipo_recurso        ENUM('image','raw') NOT NULL COMMENT 'resource_type de Cloudinary: image o raw (PDF)',
    entrega             ENUM('upload','authenticated') NOT NULL COMMENT 'upload = público; authenticated = privado con URL firmada',
    formato             VARCHAR(10)      NOT NULL COMMENT 'webp, jpg, png o pdf',
    bytes               INT UNSIGNED     NOT NULL,
    ancho               SMALLINT UNSIGNED NULL,
    alto                SMALLINT UNSIGNED NULL,
    nombre_original     VARCHAR(255)     NULL COMMENT 'Nombre del archivo del usuario (solo se guarda aquí)',
    entidad             ENUM('usuario_foto','mascota_foto','empleado_foto','negocio_logo',
                             'negocio_banner','vacuna_comprobante','historial_archivo') NOT NULL,
    id_entidad          INT UNSIGNED     NOT NULL COMMENT 'id del registro de la entidad',
    estado              ENUM('activo','por_eliminar','eliminado') NOT NULL DEFAULT 'activo',
    intentos_eliminar   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    id_usuario_subio    INT UNSIGNED     NULL,
    id_usuario_elimino  INT UNSIGNED     NULL,
    fecha_creacion      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion   DATETIME         NULL COMMENT 'Cuándo se pidió eliminar (reemplazo o DELETE)',
    PRIMARY KEY (id_archivo),
    UNIQUE KEY uq_archivos_public_id (public_id),
    INDEX idx_archivos_entidad (entidad, id_entidad, estado),
    INDEX idx_archivos_estado (estado),
    CONSTRAINT fk_archivos_subio
        FOREIGN KEY (id_usuario_subio) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_archivos_elimino
        FOREIGN KEY (id_usuario_elimino) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Archivos subidos a Cloudinary: fotos, logos, comprobantes y archivos del historial';
