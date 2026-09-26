-- ═══════════════════════════════════════════════════════════════════════════
--  004 — Tokens de verificación y recuperación, y búsqueda de sesiones por
--  refresh token
--  - Cada token de `usuarios` tiene su propio vencimiento: antes compartían
--    `token_expiracion` y pedir una recuperación pisaba el de la verificación.
--    `token_expiracion` pasa a llamarse `token_recuperacion_expira`.
--  - Los tokens se guardan como SHA-256 (64 caracteres) y se buscan por ese
--    hash: índices únicos (los NULL no chocan).
--  - `POST /auth/refresh-token` busca la sesión por el hash del refresh token.
--  No borra datos: las columnas de tokens no se usaban antes de la Fase 1.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios
    RENAME COLUMN token_expiracion TO token_recuperacion_expira,
    ADD COLUMN token_verificacion_expira DATETIME NULL AFTER token_verificacion,
    ADD UNIQUE KEY uq_usuarios_token_verificacion (token_verificacion),
    ADD UNIQUE KEY uq_usuarios_token_recuperacion (token_recuperacion);

ALTER TABLE sesiones
    ADD INDEX idx_sesiones_refresh_token (refresh_token(64));
