import db from "../../config/db.js";
import { likeLiteral } from "../../shared/utils/sql.js";

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
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono, u.ultimo_acceso IS NOT NULL AS usa_app
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

// ---------- Clientes del negocio (1.7) ----------
// Cliente = usuario activo con alguna cita con el negocio (cualquier estado) o con una
// autorización de datos que registró ese negocio.

// Agregados de las citas del negocio por cliente (alias `st`).
const SQL_ESTADISTICAS = `
  SELECT c.id_usuario,
         COUNT(*) AS total_citas,
         MIN(c.fecha) AS primera_cita,
         MAX(c.fecha) AS ultima_actividad,
         MAX(CASE WHEN c.estado NOT IN ('cancelada', 'reprogramada')
                   AND (c.fecha < CURDATE() OR (c.fecha = CURDATE() AND c.hora_fin < CURTIME()))
                  THEN c.fecha END) AS ultima_cita,
         MIN(CASE WHEN c.estado IN ('pendiente', 'confirmada')
                   AND (c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_fin >= CURTIME()))
                  THEN c.fecha END) AS proxima_cita,
         SUM(c.estado = 'no_asistio') AS inasistencias
  FROM citas c
  WHERE c.id_negocio = ?
  GROUP BY c.id_usuario`;

const ORDENES = {
  ultima_cita: "st.ultima_actividad IS NULL, st.ultima_actividad DESC, u.apellido, u.nombre, u.id_usuario",
  nombre: "u.apellido, u.nombre, u.id_usuario",
  inasistencias: "inasistencias DESC, u.apellido, u.nombre, u.id_usuario",
};

/**
 * Página de clientes del negocio. `q` busca en nombre, apellido, nombre completo,
 * email, dígitos del teléfono (con 3 o más) y nombre de sus mascotas activas.
 */
export const findPageDeNegocio = async (id_negocio, { q, orden = "ultima_cita", limit, offset }) => {
  const condiciones = [
    "u.activo = TRUE",
    "(st.id_usuario IS NOT NULL OR EXISTS (SELECT 1 FROM autorizaciones_datos a WHERE a.id_usuario = u.id_usuario AND a.id_negocio = ?))",
  ];
  const valores = [id_negocio];
  if (q) {
    const patron = likeLiteral(q);
    const digitos = q.replace(/\D/g, "");
    condiciones.push(`(u.nombre LIKE ? OR u.apellido LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR u.email LIKE ?
      ${digitos.length >= 3 ? "OR REGEXP_REPLACE(u.telefono, '[^0-9]', '') LIKE ?" : ""}
      OR EXISTS (SELECT 1 FROM mascotas m WHERE m.id_usuario = u.id_usuario AND m.activo = TRUE AND m.nombre LIKE ?))`);
    valores.push(patron, patron, patron, patron, ...(digitos.length >= 3 ? [likeLiteral(digitos)] : []), patron);
  }
  const from = `FROM usuarios u LEFT JOIN (${SQL_ESTADISTICAS}) st ON st.id_usuario = u.id_usuario`;
  const where = `WHERE ${condiciones.join(" AND ")}`;

  const [rows] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono,
            COALESCE(st.total_citas, 0) AS total_citas, st.ultima_cita, st.proxima_cita,
            COALESCE(st.inasistencias, 0) AS inasistencias,
            u.ultimo_acceso IS NOT NULL AS usa_app, st.primera_cita,
            (SELECT MIN(DATE(a.fecha_autorizacion)) FROM autorizaciones_datos a
             WHERE a.id_usuario = u.id_usuario AND a.id_negocio = ?) AS primera_autorizacion,
            EXISTS (SELECT 1 FROM autorizaciones_datos a
                    WHERE a.id_usuario = u.id_usuario AND a.id_negocio = ? AND a.canal = 'panel') AS registrado_por_el_negocio
     ${from} ${where}
     ORDER BY ${ORDENES[orden]}
     LIMIT ? OFFSET ?`,
    [id_negocio, id_negocio, id_negocio, ...valores, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${where}`, [id_negocio, ...valores]);
  return { rows, total };
};

/**
 * Datos del cliente en el negocio, o undefined si no es cliente (o su cuenta está
 * desactivada): contacto, desde cuándo, si lo registró el negocio y si usa la app.
 */
export const findClienteDeNegocio = async (id_usuario, id_negocio) => {
  const [rows] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono, u.ultimo_acceso, u.email_verificado,
            (SELECT MIN(c.fecha) FROM citas c WHERE c.id_usuario = u.id_usuario AND c.id_negocio = ?) AS primera_cita,
            (SELECT MIN(DATE(a.fecha_autorizacion)) FROM autorizaciones_datos a
             WHERE a.id_usuario = u.id_usuario AND a.id_negocio = ?) AS primera_autorizacion,
            EXISTS (SELECT 1 FROM autorizaciones_datos a
                    WHERE a.id_usuario = u.id_usuario AND a.id_negocio = ? AND a.canal = 'panel') AS registrado_por_el_negocio
     FROM usuarios u
     WHERE u.id_usuario = ? AND u.activo = TRUE`,
    [id_negocio, id_negocio, id_negocio, id_usuario]
  );
  const row = rows[0];
  if (!row || (row.primera_cita === null && row.primera_autorizacion === null)) return undefined;
  return row;
};

/**
 * Mascotas activas del cliente (también las fallecidas, marcadas), con cuántas citas
 * tienen con el negocio y si el negocio puede abrir su historial (cita válida).
 */
export const findMascotasDeCliente = async (id_usuario, id_negocio) => {
  const [rows] = await db.query(
    `SELECT m.id_mascota, m.nombre, m.especie, m.raza, m.sexo, m.fecha_nacimiento,
            TIMESTAMPDIFF(MONTH, m.fecha_nacimiento, CURDATE()) AS edad_meses, m.peso,
            m.tiene_alergias, m.alergias_detalle, m.condiciones_medicas, m.fallecido,
            (SELECT COUNT(*) FROM citas c WHERE c.id_mascota = m.id_mascota AND c.id_negocio = ?) AS citas_con_negocio,
            EXISTS (SELECT 1 FROM citas c WHERE c.id_mascota = m.id_mascota AND c.id_negocio = ?
                      AND c.estado NOT IN ('cancelada', 'reprogramada')) AS acceso_historial
     FROM mascotas m
     WHERE m.id_usuario = ? AND m.activo = TRUE
     ORDER BY m.fallecido, m.nombre, m.id_mascota`,
    [id_negocio, id_negocio, id_usuario]
  );
  return rows;
};

/**
 * Bloquea la fila del cliente (FOR UPDATE) y devuelve lo que decide si el negocio
 * puede ponerle o corregirle el correo.
 */
export const lockCuenta = async (id_usuario, conn) => {
  const [rows] = await conn.query(
    "SELECT id_usuario, email, email_verificado, ultimo_acceso FROM usuarios WHERE id_usuario = ? FOR UPDATE",
    [id_usuario]
  );
  return rows[0];
};

export const updateEmail = async (id_usuario, email, conn) => {
  await conn.query("UPDATE usuarios SET email = ? WHERE id_usuario = ?", [email, id_usuario]);
};

/** La mascota tiene alguna cita (en cualquier estado) con el negocio. */
export const mascotaTieneCitas = async (id_mascota, id_negocio) => {
  const [rows] = await db.query("SELECT 1 FROM citas WHERE id_mascota = ? AND id_negocio = ? LIMIT 1", [id_mascota, id_negocio]);
  return rows.length > 0;
};
