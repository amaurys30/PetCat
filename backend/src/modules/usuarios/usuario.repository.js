import pool from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";

// Uso interno: estas consultas devuelven la fila completa (incluye password_hash).
// Lo que sale de la API pasa por usuarioPublico o sanitizeUsuario.

export const findById = async (id_usuario, conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return rows[0];
};

/** Bloquea la fila del usuario (FOR UPDATE por clave primaria) y devuelve su foto actual. */
export const lockFoto = async (id_usuario, conn) => {
  const [rows] = await conn.query("SELECT id_usuario, foto_url FROM usuarios WHERE id_usuario = ? FOR UPDATE", [id_usuario]);
  return rows[0];
};

export const setFoto = async (id_usuario, foto_url, conn) => {
  await (conn ?? pool).query("UPDATE usuarios SET foto_url = ? WHERE id_usuario = ?", [foto_url, id_usuario]);
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

/** Inicio de sesión renovado (refresh token): solo registra el acceso. */
export const touchUltimoAcceso = async (id_usuario, conn) => {
  await (conn ?? pool).query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?", [id_usuario]);
};

/** Como findForLogin, por id (cambio de contraseña con la sesión iniciada). */
export const findForLoginById = async (id_usuario, conn) => {
  const [rows] = await (conn ?? pool).query(
    `SELECT *, (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
     FROM usuarios WHERE id_usuario = ?`,
    [id_usuario]
  );
  return rows[0];
};

// ---------- Tokens de verificación de email y de recuperación de contraseña ----------
// Se guarda el SHA-256 del token; cada uno tiene su columna de vencimiento.

const TOKEN_COLUMNAS = {
  verificacion: ["token_verificacion", "token_verificacion_expira"],
  recuperacion: ["token_recuperacion", "token_recuperacion_expira"],
};

/**
 * Guarda un token nuevo (reemplaza al anterior) con vigencia de `minutos`.
 * No lo guarda si el anterior se emitió hace menos de `esperaMinutos`: así se
 * limita a un correo por minuto por cuenta. Devuelve false en ese caso.
 */
export const setToken = async (id_usuario, tipo, { token_hash, minutos, esperaMinutos = 1 }, conn) => {
  const [token, expira] = TOKEN_COLUMNAS[tipo];
  const [result] = await (conn ?? pool).query(
    `UPDATE usuarios SET ${token} = ?, ${expira} = NOW() + INTERVAL ? MINUTE
     WHERE id_usuario = ?
       AND (${expira} IS NULL OR ${expira} <= NOW() + INTERVAL ? MINUTE)`,
    [token_hash, minutos, id_usuario, minutos - esperaMinutos]
  );
  return result.affectedRows > 0;
};

/** Usuario dueño de un token vigente; con `forUpdate` bloquea la fila. */
export const findByTokenHash = async (tipo, token_hash, { conn, forUpdate = false } = {}) => {
  const [token, expira] = TOKEN_COLUMNAS[tipo];
  const [rows] = await (conn ?? pool).query(
    `SELECT * FROM usuarios WHERE ${token} = ? AND ${expira} > NOW()${forUpdate ? " FOR UPDATE" : ""}`,
    [token_hash]
  );
  return rows[0];
};

/** Marca el email como verificado y descarta el token de verificación. */
export const markEmailVerificado = async (id_usuario, conn) => {
  await (conn ?? pool).query(
    `UPDATE usuarios
     SET email_verificado = TRUE, token_verificacion = NULL, token_verificacion_expira = NULL
     WHERE id_usuario = ?`,
    [id_usuario]
  );
};

/**
 * Cambia la contraseña, descarta el token de recuperación y reinicia el bloqueo
 * por intentos fallidos.
 */
export const updatePassword = async (id_usuario, password_hash, conn) => {
  await (conn ?? pool).query(
    `UPDATE usuarios
     SET password_hash = ?, token_recuperacion = NULL, token_recuperacion_expira = NULL,
         intentos_login = 0, bloqueado_hasta = NULL
     WHERE id_usuario = ?`,
    [password_hash, id_usuario]
  );
};

// ---------- Perfil propio (PATCH /auth/me) ----------

export const CAMPOS_PERFIL = [
  "nombre",
  "apellido",
  "telefono",
  "idioma",
  "zona_horaria",
  "notif_email",
  "notif_push",
  "notif_whatsapp",
];

/** Actualiza el perfil con la lista blanca. Si cambia el teléfono, deja de estar verificado. */
export const updatePerfil = async (id_usuario, data, conn) => {
  const campos = pick(data, CAMPOS_PERFIL);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  // MySQL asigna de izquierda a derecha: la comparación va antes de cambiar el teléfono.
  const telefonoVerificado =
    "telefono" in campos ? ["telefono_verificado = IF(telefono <=> ?, telefono_verificado, FALSE)"] : [];
  await (conn ?? pool).query(
    `UPDATE usuarios SET ${[...telefonoVerificado, ...columnas.map((c) => `${c} = ?`)].join(", ")}
     WHERE id_usuario = ?`,
    [...("telefono" in campos ? [campos.telefono] : []), ...Object.values(campos), id_usuario]
  );
};
