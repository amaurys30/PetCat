-- ═══════════════════════════════════════════════════════════════════════════
--  023 — Rastro de ediciones de las vacunas (mismo criterio que la 022)
--  Las vacunas del carnet no se borran: cada edición deja constancia. En la
--  vacuna, la última (fecha_edicion e id_usuario_edicion, que muestra el carnet);
--  en vacunas_ediciones, todas, con los campos que cambiaron y sus valores
--  anteriores. Vale para las que edita el negocio y las que edita el dueño. El
--  editor queda NULL si su cuenta se elimina; las ediciones se borran con la
--  vacuna (solo si se borra la mascota). El comprobante tiene su propio rastro en
--  `archivos`.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE vacunas
    ADD COLUMN fecha_edicion      DATETIME     NULL COMMENT 'Última edición' AFTER fecha_creacion,
    ADD COLUMN id_usuario_edicion INT UNSIGNED NULL COMMENT 'Quién hizo la última edición' AFTER fecha_edicion,
    ADD CONSTRAINT fk_vacunas_usuario_edicion
        FOREIGN KEY (id_usuario_edicion) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE vacunas_ediciones (
    id_edicion         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_vacuna          INT UNSIGNED    NOT NULL,
    id_usuario         INT UNSIGNED    NULL,
    campos             JSON            NOT NULL COMMENT 'Campos que cambiaron',
    valores_anteriores JSON            NOT NULL COMMENT 'Valor de cada campo antes de la edición',
    fecha              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_edicion),
    INDEX idx_vacunas_ediciones_vacuna (id_vacuna, fecha),
    CONSTRAINT fk_vacunas_ediciones_vacuna
        FOREIGN KEY (id_vacuna) REFERENCES vacunas (id_vacuna)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_vacunas_ediciones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada edición de una vacuna: quién, cuándo, qué campos y sus valores anteriores';
