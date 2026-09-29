-- ═══════════════════════════════════════════════════════════════════════════
--  019 — Notas del negocio sobre sus clientes (2.7)
--  Visibles solo dentro del negocio que las escribió, nunca para el cliente ni
--  para otros negocios. Borrado físico (excepción a la convención de borrado
--  lógico): si el negocio borra una nota, el dato personal desaparece.
--  Negocio y cliente en cascada (la supresión de datos del titular arrastra sus
--  notas); el autor queda NULL si su cuenta se elimina.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE notas_cliente (
    id_nota          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_usuario       INT UNSIGNED    NOT NULL COMMENT 'Cliente sobre el que es la nota',
    id_usuario_autor INT UNSIGNED    NULL COMMENT 'Propietario o empleado que la escribió',
    texto            VARCHAR(1000)   NOT NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_edicion    DATETIME        NULL,
    PRIMARY KEY (id_nota),
    INDEX idx_notas_cliente (id_negocio, id_usuario, fecha_creacion),
    CONSTRAINT fk_notas_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notas_cliente
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notas_autor
        FOREIGN KEY (id_usuario_autor) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notas internas del negocio sobre un cliente (solo las ve ese negocio)';
