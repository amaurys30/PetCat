import db from "../../config/db.js";

export const MAX_RESULTADOS_BUSQUEDA = 5;

/**
 * Usuarios activos con ese email o ese teléfono (comparando solo dígitos).
 * Datos mínimos de contacto, sin nada más de la cuenta.
 */
export const buscar = async ({ email, telefono }) => {
  const [condicion, valor] = email
    ? ["u.email = ?", email]
    : ["REGEXP_REPLACE(u.telefono, '[^0-9]', '') = ?", telefono];
  const [rows] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono
     FROM usuarios u
     WHERE u.activo = TRUE AND ${condicion}
     ORDER BY u.id_usuario
     LIMIT ?`,
    [valor, MAX_RESULTADOS_BUSQUEDA]
  );
  return rows;
};

/** Mascotas activas y vivas de esos usuarios: { [id_usuario]: [mascota] }. */
export const findMascotasVivas = async (ids) => {
  if (ids.length === 0) return {};
  const [rows] = await db.query(
    `SELECT id_usuario, id_mascota, nombre, especie, raza
     FROM mascotas
     WHERE id_usuario IN (?) AND activo = TRUE AND fallecido = FALSE
     ORDER BY nombre, id_mascota`,
    [ids]
  );
  const porUsuario = {};
  for (const { id_usuario, ...mascota } of rows) (porUsuario[id_usuario] ??= []).push(mascota);
  return porUsuario;
};

/** Usuario activo (cliente) con los datos que devuelve el panel. */
export const findActivo = async (id_usuario, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT id_usuario, nombre, apellido, email, telefono FROM usuarios WHERE id_usuario = ? AND activo = TRUE",
    [id_usuario]
  );
  return rows[0];
};

/** El cliente tiene relación con el negocio: alguna cita con él o una autorización registrada por él. */
export const tieneRelacion = async (id_usuario, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT EXISTS (SELECT 1 FROM citas WHERE id_usuario = ? AND id_negocio = ?)
         OR EXISTS (SELECT 1 FROM autorizaciones_datos WHERE id_usuario = ? AND id_negocio = ?) AS relacion`,
    [id_usuario, id_negocio, id_usuario, id_negocio]
  );
  return Boolean(rows[0].relacion);
};
