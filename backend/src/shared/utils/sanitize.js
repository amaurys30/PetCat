// Columnas de `usuarios` que nunca salen de la API.
const USUARIO_PRIVATE_FIELDS = [
  "password_hash",
  "token_verificacion",
  "token_recuperacion",
  "token_expiracion",
  "refresh_token",
];

/**
 * Quita de un usuario los campos sensibles. Acepta null y devuelve null.
 */
export const sanitizeUsuario = (usuario) => {
  if (!usuario) return usuario ?? null;
  const safe = { ...usuario };
  for (const field of USUARIO_PRIVATE_FIELDS) delete safe[field];
  return safe;
};
