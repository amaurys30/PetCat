-- ═══════════════════════════════════════════════════════════════════════════
--  025 — Quién creó cada suscripción
--  Mientras no hay pagos en línea, el super admin asigna los planes a mano
--  (PUT /negocios/:id/suscripcion): cada fila guarda qué admin la creó, y el
--  historial de la administración lo muestra. En la prueba Pro queda el
--  propietario que la activó; la Gratuita que se crea con el negocio queda en
--  NULL. Las existentes quedan en NULL (no se sabe). Si se elimina la cuenta, el
--  registro queda en NULL. Además, cada asignación deja una fila en
--  auditoria_global (antes y después, IP y navegador).
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE suscripciones
    ADD COLUMN id_usuario_registro INT UNSIGNED NULL
        COMMENT 'Quién la creó: el admin que asignó el plan o el propietario que activó la prueba' AFTER notas,
    ADD CONSTRAINT fk_suscripciones_usuario_registro
        FOREIGN KEY (id_usuario_registro) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE;
