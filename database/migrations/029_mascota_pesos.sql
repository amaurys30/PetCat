-- ═══════════════════════════════════════════════════════════════════════════
--  029 — Historial de peso de las mascotas (gráfico de la ficha en la app)
--  Antes solo existía el peso actual (`mascotas.peso`) y el `peso_registro` de cada
--  registro médico: si el dueño cambiaba el peso, no quedaba rastro.
--  - origen `historial`: un registro médico con peso (uno por registro, id_historial único).
--  - origen `dueno`: el dueño lo registra al crear o editar la mascota (uno por día).
--  Copia los pesos del historial y, para las mascotas sin ninguno, el peso actual con
--  la fecha de su última actualización. No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE mascota_pesos (
    id_peso         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_mascota      INT UNSIGNED    NOT NULL,
    peso            DECIMAL(6,2)    NOT NULL COMMENT 'En kilogramos',
    fecha           DATE            NOT NULL,
    origen          ENUM('dueno','historial') NOT NULL,
    id_historial    BIGINT UNSIGNED NULL COMMENT 'Registro médico de donde sale (origen historial)',
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_peso),
    UNIQUE KEY uq_pesos_historial (id_historial),
    INDEX idx_pesos_mascota_fecha (id_mascota, fecha),
    CONSTRAINT fk_pesos_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pesos_historial
        FOREIGN KEY (id_historial) REFERENCES historial_medico (id_historial)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de peso de las mascotas (registros médicos y lo que anota el dueño)';

INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen, id_historial)
SELECT h.id_mascota, h.peso_registro, h.fecha, 'historial', h.id_historial
FROM historial_medico h
WHERE h.peso_registro IS NOT NULL;

INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen)
SELECT m.id_mascota, m.peso, DATE(m.fecha_actualizacion), 'dueno'
FROM mascotas m
WHERE m.peso IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mascota_pesos p WHERE p.id_mascota = m.id_mascota);
