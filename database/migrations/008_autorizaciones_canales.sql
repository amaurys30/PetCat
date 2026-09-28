-- ═══════════════════════════════════════════════════════════════════════════
--  008 — Canales de autorización de datos
--  Toda cuenta nueva registra su autorización. Canales:
--  - app:        el titular se registró en la app (POST /auth/register).
--  - panel:      un negocio registró al cliente y tomó su autorización.
--  - invitacion: el titular la dio al aceptar una invitación de empleado que
--                creó su cuenta (id_negocio = negocio que lo invitó).
--  - aceptacion: una cuenta existente aceptó la versión vigente de la política.
--  No cambia filas existentes.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE autorizaciones_datos
    MODIFY COLUMN canal ENUM('app','panel','invitacion','aceptacion') NOT NULL;
