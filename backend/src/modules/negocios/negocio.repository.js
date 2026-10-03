import db from "../../config/db.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { pick } from "../../shared/utils/pick.js";
import { CAMPOS_NEGOCIO } from "./negocio.schemas.js";
import { SQL_OFERTA_VIGENTE, SQL_PRECIO_ACTUAL, SQL_RESERVABLE } from "../servicios/servicio.repository.js";

export const findById = async (id_negocio, conn) => {
  const [rows] = await (conn ?? db).query("SELECT * FROM negocios WHERE id_negocio = ?", [id_negocio]);
  return rows[0];
};

/** Crea el negocio con los campos de la lista blanca y devuelve su id. */
export const create = async (id_usuario_propietario, data, conn) => {
  const campos = { ...pick(data, CAMPOS_NEGOCIO), id_usuario_propietario };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO negocios (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_negocio, data, conn) => {
  const campos = pick(data, CAMPOS_NEGOCIO);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE negocios SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_negocio = ?`,
    [...Object.values(campos), id_negocio]
  );
};

/** Bloquea la fila del negocio (FOR UPDATE por clave primaria) y devuelve su logo y banner. */
export const lockImagenes = async (id_negocio, conn) => {
  const [rows] = await conn.query(
    "SELECT logo_url, banner_url FROM negocios WHERE id_negocio = ? FOR UPDATE",
    [id_negocio]
  );
  return rows[0];
};

// Columnas de imagen del negocio (lista blanca: el nombre de columna no viene del usuario).
const COLUMNAS_IMAGEN = ["logo_url", "banner_url"];

export const setImagen = async (id_negocio, columna, url, conn) => {
  if (!COLUMNAS_IMAGEN.includes(columna)) throw new Error(`Columna de imagen no permitida: ${columna}`);
  await (conn ?? db).query(`UPDATE negocios SET ${columna} = ? WHERE id_negocio = ?`, [url, id_negocio]);
};

// Primer paso de configuración que le falta al negocio: una sede activa y, en alguna, horario.
const SQL_CONFIGURACION_PENDIENTE = `CASE
    WHEN NOT EXISTS (SELECT 1 FROM sucursales s WHERE s.id_negocio = n.id_negocio AND s.activo = TRUE) THEN 'sede'
    WHEN NOT EXISTS (SELECT 1 FROM sucursales s
                     JOIN horarios_negocio h ON h.id_sucursal = s.id_sucursal AND h.activo = TRUE
                     WHERE s.id_negocio = n.id_negocio AND s.activo = TRUE) THEN 'horarios'
  END`;

/**
 * Negocios del panel del usuario: los propios (activos o no) y los activos donde
 * es empleado activo. Si es propietario y empleado del mismo, cuenta como propietario.
 */
export const findMios = async (id_usuario) => {
  const columnas = `n.id_negocio, n.nombre, n.tipo, n.ciudad, n.logo_url, n.verificado, n.activo,
                    ${SQL_CONFIGURACION_PENDIENTE} AS configuracion_pendiente`;
  const [rows] = await db.query(
    `SELECT ${columnas}, 'propietario' AS relacion,
            NULL AS id_empleado, NULL AS id_rol, NULL AS rol_nombre, NULL AS permisos_json
     FROM negocios n
     WHERE n.id_usuario_propietario = ?
     UNION ALL
     SELECT ${columnas}, 'empleado' AS relacion,
            e.id_empleado, r.id_rol, r.nombre AS rol_nombre, r.permisos_json
     FROM empleados e
     JOIN negocios n ON n.id_negocio = e.id_negocio
     JOIN roles r ON r.id_rol = e.id_rol
     WHERE e.id_usuario = ? AND e.activo = TRUE AND n.activo = TRUE
       AND n.id_usuario_propietario <> ?
     ORDER BY nombre, id_negocio`,
    [id_usuario, id_usuario, id_usuario]
  );
  return rows;
};

/** Citas del negocio que el sistema canceló (nadie las confirmó) desde `desde` (DATETIME). */
export const countCanceladasPorSistema = async (id_negocio, desde) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM citas
     WHERE id_negocio = ? AND estado = 'cancelada' AND cancelada_por = 'sistema' AND fecha_cancelacion >= ?`,
    [id_negocio, desde]
  );
  return Number(row.total);
};

// ---------- Perfil público (app) ----------

export const findPublicoById = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT id_negocio, nombre, tipo, descripcion, telefono, whatsapp, email, sitio_web,
            direccion, ciudad, departamento, latitud, longitud, logo_url, banner_url,
            calificacion_promedio, total_resenas, verificado, confirmacion_automatica
     FROM negocios
     WHERE id_negocio = ? AND activo = TRUE`,
    [id_negocio]
  );
  return rows[0];
};

export const findSucursalesPublicas = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT id_sucursal, id_negocio, nombre, descripcion, telefono, direccion, ciudad, latitud, longitud, es_principal
     FROM sucursales
     WHERE id_negocio = ? AND activo = TRUE
     ORDER BY es_principal DESC, id_sucursal`,
    [id_negocio]
  );
  return rows;
};

/** Horarios activos de las sucursales activas del negocio (sin mirar si el negocio está activo). */
export const findHorariosPublicos = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT h.id_sucursal, h.dia_semana,
            TIME_FORMAT(h.hora_apertura, '%H:%i') AS hora_apertura,
            TIME_FORMAT(h.hora_cierre, '%H:%i') AS hora_cierre
     FROM horarios_negocio h
     JOIN sucursales s ON s.id_sucursal = h.id_sucursal
     WHERE s.id_negocio = ? AND s.activo = TRUE AND h.activo = TRUE
     ORDER BY h.id_sucursal, h.dia_semana, h.hora_apertura`,
    [id_negocio]
  );
  return rows;
};

export const findServiciosPublicos = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT s.id_servicio, s.nombre, s.descripcion, s.precio_base, s.precio_maximo, s.tipo_precio,
            s.duracion_minutos, s.tipo_mascota, s.en_oferta, s.precio_oferta,
            ${SQL_PRECIO_ACTUAL} AS precio_actual, ${SQL_OFERTA_VIGENTE} AS oferta_vigente,
            ${SQL_RESERVABLE} AS reservable,
            c.id_categoria, c.nombre AS categoria
     FROM servicios s
     JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
     WHERE s.id_negocio = ? AND s.activo = TRUE AND s.visible_app = TRUE
     ORDER BY c.orden_display, s.nombre`,
    [id_negocio]
  );
  return rows;
};

// ---------- Resolución del negocio de un recurso (authorize) ----------

// Consulta que da el id_negocio de un recurso a partir del parámetro de ruta que lo identifica.
const NEGOCIO_DE_RECURSO = {
  id_sucursal: "SELECT id_negocio FROM sucursales WHERE id_sucursal = ?",
  id_empleado: "SELECT id_negocio FROM empleados WHERE id_empleado = ?",
  id_rol: "SELECT id_negocio FROM roles WHERE id_rol = ?",
  id_servicio: "SELECT id_negocio FROM servicios WHERE id_servicio = ?",
  id_cita: "SELECT id_negocio FROM citas WHERE id_cita = ?",
  id_producto: "SELECT id_negocio FROM productos WHERE id_producto = ?",
  // NULL = registro sin negocio (vacuna del dueño): recurso global para authorize.
  id_historial: "SELECT id_negocio FROM historial_medico WHERE id_historial = ?",
  id_vacuna: "SELECT id_negocio FROM vacunas WHERE id_vacuna = ?",
  // Una reseña que retiró su autor ya no existe para el negocio.
  id_resena: "SELECT id_negocio FROM resenas WHERE id_resena = ? AND retirada_en IS NULL",
  id_nota: "SELECT id_negocio FROM notas_cliente WHERE id_nota = ?",
  id_disponibilidad: `SELECT e.id_negocio
                      FROM disponibilidad_empleado d
                      JOIN empleados e ON e.id_empleado = d.id_empleado
                      WHERE d.id_disponibilidad = ?`,
};

export const RECURSOS_CON_NEGOCIO = Object.keys(NEGOCIO_DE_RECURSO);

/**
 * Negocio al que pertenece un recurso. Devuelve undefined si el recurso no existe
 * y { id_negocio: null } si existe pero no es de ningún negocio (rol del sistema).
 */
export const findNegocioDeRecurso = async (param, id) => {
  const sql = NEGOCIO_DE_RECURSO[param];
  if (!sql) throw ApiError.internal(`Recurso sin resolver de negocio: ${param}`);
  const [rows] = await db.query(sql, [id]);
  return rows[0];
};
