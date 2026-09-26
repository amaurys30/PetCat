// Columnas de `usuarios` que nunca salen de la API.
const USUARIO_PRIVATE_FIELDS = [
  "password_hash",
  "token_verificacion",
  "token_verificacion_expira",
  "token_recuperacion",
  "token_recuperacion_expira",
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

// Campos de `usuarios` que la API devuelve como perfil propio (login, registro, invitaciones).
const USUARIO_PUBLIC_FIELDS = [
  "id_usuario",
  "nombre",
  "apellido",
  "email",
  "telefono",
  "foto_url",
  "tipo_usuario",
  "email_verificado",
];

/**
 * Perfil del usuario con una lista blanca de campos. Los booleanos de MySQL
 * (0/1) se devuelven como true/false.
 */
export const usuarioPublico = (usuario) => {
  if (!usuario) return null;
  const result = {};
  for (const field of USUARIO_PUBLIC_FIELDS) {
    if (field in usuario) result[field] = usuario[field];
  }
  if ("email_verificado" in result) result.email_verificado = Boolean(result.email_verificado);
  return result;
};
