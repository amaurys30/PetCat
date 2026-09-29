-- ═══════════════════════════════════════════════════════════════════════════
--  016 — Contacto de soporte en los avisos del plan (2.4)
--  Los avisos del plan (prueba por terminar, plan vencido y límites de citas)
--  dicen cómo comunicarse con PetCat. `contacto_soporte` pasa a `soporte_email`
--  (conserva su valor; también lo usa el correo de bienvenida) y se agrega
--  `soporte_whatsapp`. Vacío = no se muestra.
--  No borra datos.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE configuracion_global
SET clave = 'soporte_email',
    descripcion = 'Correo de soporte de la plataforma: avisos del plan y correo de bienvenida (vacío = no se muestra)'
WHERE clave = 'contacto_soporte';

INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('soporte_whatsapp', '', 'string', 'WhatsApp de soporte para los avisos del plan, p. ej. +57 300 123 4567 (vacío = no se muestra)');
