-- ═══════════════════════════════════════════════════════════════════════════
--  030 — Número del Pasaporte PetCat (app M3)
--  Código público, aleatorio y estable por mascota: PC-XXXX-XXXX con 8 caracteres
--  de un alfabeto de 30 sin los que se confunden (sin 0/O, 1/I/L ni U). No sale del
--  id, así que no deja adivinar cuántas mascotas hay ni recorrer números. Es un dato
--  visible, no una credencial: no da acceso a nada.
--  - fn_codigo_pasaporte(): genera un código con RANDOM_BYTES (aleatorio criptográfico).
--  - trg_mascotas_before_insert: lo asigna al crear la mascota. No busca antes si el código
--    existe: ese SELECT, dentro del INSERT, toma bloqueos compartidos en el índice único y dos
--    altas simultáneas se bloqueaban entre sí (deadlock). La unicidad la garantiza el índice;
--    si un código choca (≈1 en 10^11), la API reintenta (mascota.repository.js, create).
--  Reejecutable (MySQL no revierte DDL): si falla a mitad, se vuelve a correr y termina.
--  Cada paso revisa el estado: columna (nula al inicio), relleno de las filas sin código,
--  duplicados resueltos aquí mismo, y al final NOT NULL e índice único.
--  Requisito del servidor: con el binlog activo, crear la función y el trigger exige root/SUPER
--  o log_bin_trust_function_creators=1 (igual que los triggers que ya existían). Las copias
--  necesitan mysqldump --routines (ver backend/README.md, "Copias de seguridad").
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS fn_codigo_pasaporte;
DROP PROCEDURE IF EXISTS tmp_030_columna;
DROP PROCEDURE IF EXISTS tmp_030_completar;

DELIMITER $$

CREATE FUNCTION fn_codigo_pasaporte() RETURNS CHAR(12) CHARSET ascii
    NOT DETERMINISTIC NO SQL
    COMMENT 'Código del Pasaporte PetCat: PC-XXXX-XXXX, aleatorio'
BEGIN
    DECLARE alfabeto CHAR(30) CHARSET ascii DEFAULT '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    DECLARE codigo VARCHAR(12) CHARSET ascii DEFAULT 'PC-';
    DECLARE i TINYINT DEFAULT 0;
    WHILE i < 8 DO
        IF i = 4 THEN
            SET codigo = CONCAT(codigo, '-');
        END IF;
        -- 2 bytes (0-65535) módulo 30: el sesgo es despreciable.
        SET codigo = CONCAT(codigo, SUBSTRING(alfabeto, 1 + MOD(CONV(HEX(RANDOM_BYTES(2)), 16, 10), 30), 1));
        SET i = i + 1;
    END WHILE;
    RETURN codigo;
END$$

-- Paso 1: la columna, nula mientras se rellena.
CREATE PROCEDURE tmp_030_columna()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mascotas' AND COLUMN_NAME = 'codigo_pasaporte'
    ) THEN
        ALTER TABLE mascotas
            ADD COLUMN codigo_pasaporte CHAR(12) CHARACTER SET ascii COLLATE ascii_bin NULL
                COMMENT 'Número del Pasaporte PetCat (PC-XXXX-XXXX), aleatorio y estable'
                AFTER numero_registro;
    END IF;
END$$

-- Paso 3: rellenar, resolver duplicados, NOT NULL e índice único.
CREATE PROCEDURE tmp_030_completar()
BEGIN
    UPDATE mascotas
    SET codigo_pasaporte = fn_codigo_pasaporte()
    WHERE codigo_pasaporte IS NULL OR codigo_pasaporte = '';

    -- Duplicados (de este relleno o de una corrida anterior que falló antes del índice):
    -- en cada grupo conserva el código la mascota más antigua; las demás reciben uno nuevo.
    -- Se repite hasta que no quede ninguno.
    WHILE EXISTS (
        SELECT 1 FROM mascotas GROUP BY codigo_pasaporte HAVING COUNT(*) > 1
    ) DO
        UPDATE mascotas m
        JOIN (
            SELECT codigo_pasaporte, MIN(id_mascota) AS conservar
            FROM mascotas
            GROUP BY codigo_pasaporte
            HAVING COUNT(*) > 1
        ) d ON d.codigo_pasaporte = m.codigo_pasaporte AND m.id_mascota <> d.conservar
        SET m.codigo_pasaporte = fn_codigo_pasaporte();
    END WHILE;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mascotas'
          AND COLUMN_NAME = 'codigo_pasaporte' AND IS_NULLABLE = 'YES'
    ) THEN
        ALTER TABLE mascotas
            MODIFY COLUMN codigo_pasaporte CHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
                COMMENT 'Número del Pasaporte PetCat (PC-XXXX-XXXX), aleatorio y estable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mascotas'
          AND INDEX_NAME = 'uq_mascotas_codigo_pasaporte'
    ) THEN
        ALTER TABLE mascotas ADD UNIQUE KEY uq_mascotas_codigo_pasaporte (codigo_pasaporte);
    END IF;
END$$

DELIMITER ;

CALL tmp_030_columna();

-- Paso 2: el trigger, antes del relleno, para que una mascota creada durante la migración
-- también reciba su código.
DROP TRIGGER IF EXISTS trg_mascotas_before_insert;

DELIMITER $$

CREATE TRIGGER trg_mascotas_before_insert
BEFORE INSERT ON mascotas
FOR EACH ROW
BEGIN
    IF NEW.codigo_pasaporte IS NULL OR NEW.codigo_pasaporte = '' THEN
        SET NEW.codigo_pasaporte = fn_codigo_pasaporte();
    END IF;
END$$

DELIMITER ;

CALL tmp_030_completar();

DROP PROCEDURE tmp_030_columna;
DROP PROCEDURE tmp_030_completar;
