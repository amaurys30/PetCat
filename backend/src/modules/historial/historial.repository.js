import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { CAMPOS_HISTORIAL } from "./historial.schemas.js";

const SELECT_HISTORIAL = `
  SELECT h.id_historial, h.id_mascota, h.id_cita, h.id_negocio, n.nombre AS negocio_nombre,
         h.id_empleado, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
         h.tipo, h.fecha, h.motivo_consulta, h.diagnostico, h.tratamiento, h.medicamentos_prescritos,
         h.indicaciones, h.proximo_control, h.peso_registro, h.temperatura, h.frecuencia_cardiaca,
         h.frecuencia_respiratoria, h.archivos_json, h.notas_internas, h.fecha_creacion
  FROM historial_medico h
  LEFT JOIN negocios n ON n.id_negocio = h.id_negocio
  LEFT JOIN empleados e ON e.id_empleado = h.id_empleado`;

export const findById = async (id_historial, conn) => {
  const [rows] = await (conn ?? db).query(`${SELECT_HISTORIAL} WHERE h.id_historial = ?`, [id_historial]);
  return rows[0];
};

/**
 * Registros de la mascota, del más reciente al más antiguo. `soloNegocio` limita a
 * los que creó ese negocio (compartir_historial en FALSE). Filtros: tipo y fechas.
 */
export const findPage = async (id_mascota, { soloNegocio, tipo, desde, hasta, limit, offset }) => {
  const condiciones = ["h.id_mascota = ?"];
  const valores = [id_mascota];
  for (const [condicion, valor] of [
    ["h.id_negocio = ?", soloNegocio],
    ["h.tipo = ?", tipo],
    ["h.fecha >= ?", desde],
    ["h.fecha <= ?", hasta],
  ]) {
    if (valor !== undefined) {
      condiciones.push(condicion);
      valores.push(valor);
    }
  }
  const where = `WHERE ${condiciones.join(" AND ")}`;
  const [rows] = await db.query(
    `${SELECT_HISTORIAL} ${where} ORDER BY h.fecha DESC, h.id_historial DESC LIMIT ? OFFSET ?`,
    [...valores, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM historial_medico h ${where}`, valores);
  return { rows, total };
};

/** Registros visibles para el resumen de salud (todos o solo los de un negocio). */
export const findParaResumen = async (id_mascota, soloNegocio) => {
  const [rows] = await db.query(
    `${SELECT_HISTORIAL}
     WHERE h.id_mascota = ? ${soloNegocio !== undefined ? "AND h.id_negocio = ?" : ""}
     ORDER BY h.fecha DESC, h.id_historial DESC`,
    soloNegocio !== undefined ? [id_mascota, soloNegocio] : [id_mascota]
  );
  return rows;
};

const columnasDe = (data) => {
  const campos = pick(data, CAMPOS_HISTORIAL);
  if ("archivos" in data) campos.archivos_json = data.archivos === null ? null : JSON.stringify(data.archivos);
  return campos;
};

export const create = async ({ id_mascota, id_negocio, id_cita = null, ...data }, conn) => {
  const campos = { ...columnasDe(data), id_mascota, id_negocio, id_cita };
  const columnas = Object.keys(campos);
  const [result] = await conn.query(
    `INSERT INTO historial_medico (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_historial, data, conn) => {
  const campos = columnasDe(data);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await conn.query(`UPDATE historial_medico SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_historial = ?`, [
    ...Object.values(campos),
    id_historial,
  ]);
};

/** Cita del negocio con esa mascota, para ligar el registro (o undefined). */
export const findCitaDelNegocio = async (id_cita, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query("SELECT id_cita, id_mascota, estado FROM citas WHERE id_cita = ? AND id_negocio = ?", [
    id_cita,
    id_negocio,
  ]);
  return rows[0];
};

/** Empleado activo del negocio (quien atendió). */
export const empleadoActivoDelNegocio = async (id_empleado, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM empleados WHERE id_empleado = ? AND id_negocio = ? AND activo = TRUE",
    [id_empleado, id_negocio]
  );
  return rows.length > 0;
};

/** Fecha del registro con peso más reciente de la mascota, sin contar `excluirId`. */
export const fechaUltimoPeso = async (id_mascota, excluirId, conn) => {
  const [[row]] = await conn.query(
    `SELECT MAX(fecha) AS fecha FROM historial_medico
     WHERE id_mascota = ? AND peso_registro IS NOT NULL AND id_historial <> ?`,
    [id_mascota, excluirId]
  );
  return row.fecha;
};

export const actualizarPesoMascota = async (id_mascota, peso, conn) => {
  await conn.query("UPDATE mascotas SET peso = ? WHERE id_mascota = ?", [peso, id_mascota]);
};

/** Bloquea el registro (FOR UPDATE por clave primaria) y devuelve su mascota. */
export const lockRegistro = async (id_historial, conn) => {
  const [rows] = await conn.query("SELECT id_mascota FROM historial_medico WHERE id_historial = ? FOR UPDATE", [id_historial]);
  return rows[0];
};
