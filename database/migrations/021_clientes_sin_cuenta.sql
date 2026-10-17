-- ═══════════════════════════════════════════════════════════════════════════
--  021 — Clientes sin cuenta (registrados desde el panel sin correo)
--  - usuarios.email pasa a ser opcional: un negocio puede registrar a un cliente
--    que llega al mostrador o llama y no tiene correo. Sin correo no hay cuenta:
--    no recibe la bienvenida, no puede iniciar sesión ni recuperar la contraseña
--    (todo eso es por correo) y no le llegan recordatorios.
--  - Sigue siendo único (MySQL admite varios NULL en un índice UNIQUE).
--  - Sin correo, el teléfono es obligatorio: el negocio lo encuentra por teléfono.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios
    MODIFY COLUMN email VARCHAR(150) NULL,
    ADD CONSTRAINT chk_usuarios_contacto CHECK (email IS NOT NULL OR telefono IS NOT NULL);
