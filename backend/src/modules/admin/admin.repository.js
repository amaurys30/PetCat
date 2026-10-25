import { pool } from "../../config/db.js";

/**
 * Negocios (activos o no) con su propietario, para la administración. `q` busca en el nombre,
 * la ciudad y el correo del propietario; la colación no distingue tildes ni mayúsculas.
 */
export const findNegocios = async ({ q }) => {
  const filtro = q ? "WHERE n.nombre LIKE ? OR n.ciudad LIKE ? OR u.email LIKE ?" : "";
  const patron = `%${q ?? ""}%`;
  const [rows] = await pool.query(
    `SELECT n.id_negocio, n.nombre, n.tipo, n.ciudad, n.activo, n.fecha_registro,
            u.id_usuario AS propietario_id, u.nombre AS propietario_nombre,
            u.apellido AS propietario_apellido, u.email AS propietario_email
     FROM negocios n
     JOIN usuarios u ON u.id_usuario = n.id_usuario_propietario
     ${filtro}
     ORDER BY n.nombre, n.id_negocio`,
    q ? [patron, patron, patron] : []
  );
  return rows;
};

/** Citas de este mes de varios negocios (sin canceladas ni reprogramadas, como el límite del plan). */
export const countCitasMes = async (ids, hoy) => {
  if (ids.length === 0) return {};
  const [rows] = await pool.query(
    `SELECT id_negocio, COUNT(*) AS total FROM citas
     WHERE id_negocio IN (?)
       AND fecha BETWEEN DATE_FORMAT(?, '%Y-%m-01') AND LAST_DAY(?)
       AND estado NOT IN ('cancelada', 'reprogramada')
     GROUP BY id_negocio`,
    [ids, hoy, hoy]
  );
  return Object.fromEntries(rows.map((r) => [r.id_negocio, Number(r.total)]));
};

export const existeNegocio = async (id_negocio) => {
  const [rows] = await pool.query("SELECT 1 FROM negocios WHERE id_negocio = ?", [id_negocio]);
  return rows.length > 0;
};
