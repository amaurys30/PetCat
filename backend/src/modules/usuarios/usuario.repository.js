import pool from "../../config/db.js";

// Uso interno: estas consultas devuelven la fila completa (incluye password_hash).
// Lo que sale de la API pasa por usuarioPublico o sanitizeUsuario.

export const findById = async (id_usuario, conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return rows[0];
};

export const findByEmail = async (email, conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM usuarios WHERE email = ?", [email]);
  return rows[0];
};

/**
 * Usuario para el login, con `bloqueado` calculado en MySQL (mismo reloj que
 * guarda `bloqueado_hasta`).
 */
export const findForLogin = async (email, conn) => {
  const [rows] = await (conn ?? pool).query(
    `SELECT *, (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
     FROM usuarios WHERE email = ?`,
    [email]
  );
  return rows[0];
};

/** Crea un usuario y devuelve su id. */
export const create = async (
  { nombre, apellido, email, password_hash, telefono = null, tipo_usuario = "cliente", email_verificado = false },
  conn
) => {
  const [result] = await (conn ?? pool).query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, apellido, email, password_hash, telefono, tipo_usuario, email_verificado]
  );
  return result.insertId;
};

/**
 * Suma un intento fallido y bloquea la cuenta `minutos` al llegar a `maxIntentos`.
 * Si había un bloqueo ya vencido, el conteo empieza de nuevo.
 * MySQL aplica las asignaciones en orden: la segunda ve el `intentos_login` nuevo.
 * Devuelve true si la cuenta quedó bloqueada.
 */
export const registerFailedLogin = async (id_usuario, maxIntentos, minutos) => {
  await pool.query(
    `UPDATE usuarios
     SET intentos_login = IF(bloqueado_hasta IS NOT NULL AND bloqueado_hasta <= NOW(),
                             1, LEAST(intentos_login + 1, 100)),
         bloqueado_hasta = IF(intentos_login >= ?,
                              NOW() + INTERVAL ? MINUTE,
                              IF(bloqueado_hasta <= NOW(), NULL, bloqueado_hasta))
     WHERE id_usuario = ?`,
    [maxIntentos, minutos, id_usuario]
  );
  const [[row]] = await pool.query(
    "SELECT (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado FROM usuarios WHERE id_usuario = ?",
    [id_usuario]
  );
  return Boolean(row?.bloqueado);
};

/** Login correcto: reinicia el contador de intentos y registra el acceso. */
export const registerSuccessfulLogin = async (id_usuario, conn) => {
  await (conn ?? pool).query(
    `UPDATE usuarios SET intentos_login = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW()
     WHERE id_usuario = ?`,
    [id_usuario]
  );
};
