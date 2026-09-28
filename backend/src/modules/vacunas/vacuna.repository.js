import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { CAMPOS_VACUNA } from "./vacuna.schemas.js";

const SELECT_VACUNA = `
  SELECT v.id_vacuna, v.id_mascota, v.id_historial_medico, v.id_negocio, n.nombre AS negocio_nombre,
         v.registrada_por, v.id_usuario_registro,
         v.id_empleado, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
         v.nombre_vacuna, v.enfermedad_objetivo, v.laboratorio, v.lote, v.dosis, v.via_administracion,
         v.sitio_aplicacion, v.fecha_aplicacion, v.fecha_proxima, v.estado, v.comprobante_url, v.notas,
         v.fecha_creacion
  FROM vacunas v
  LEFT JOIN negocios n ON n.id_negocio = v.id_negocio
  LEFT JOIN empleados e ON e.id_empleado = v.id_empleado`;

export const findById = async (id_vacuna, conn) => {
  const [rows] = await (conn ?? db).query(`${SELECT_VACUNA} WHERE v.id_vacuna = ?`, [id_vacuna]);
  return rows[0];
};

/** Todas las vacunas de la mascota, de la aplicación más reciente a la más antigua. */
export const findDeMascota = async (id_mascota, conn) => {
  const [rows] = await (conn ?? db).query(
    `${SELECT_VACUNA} WHERE v.id_mascota = ? ORDER BY v.fecha_aplicacion DESC, v.id_vacuna DESC`,
    [id_mascota]
  );
  return rows;
};

/** Bloquea la vacuna y devuelve su mascota, quién la registró y el comprobante externo (anterior a la 2.2). */
export const lockVacuna = async (id_vacuna, conn) => {
  const [rows] = await conn.query(
    "SELECT id_vacuna, id_mascota, id_negocio, registrada_por, comprobante_url FROM vacunas WHERE id_vacuna = ? FOR UPDATE",
    [id_vacuna]
  );
  return rows[0];
};

/** El comprobante subido vive en `archivos`: al subir o quitar uno se borra la URL externa anterior. */
export const quitarComprobanteExterno = async (id_vacuna, conn) => {
  await conn.query("UPDATE vacunas SET comprobante_url = NULL WHERE id_vacuna = ?", [id_vacuna]);
};

/** Dueño y mascota de la vacuna (sin bloquear; la mascota de una vacuna no cambia). */
export const findMascotaDeVacuna = async (id_vacuna) => {
  const [rows] = await db.query(
    "SELECT v.id_mascota, m.id_usuario FROM vacunas v JOIN mascotas m ON m.id_mascota = v.id_mascota WHERE v.id_vacuna = ?",
    [id_vacuna]
  );
  return rows[0];
};

export const create = async ({ id_mascota, id_negocio = null, registrada_por, id_usuario_registro, ...data }, conn) => {
  const campos = { ...pick(data, CAMPOS_VACUNA), id_mascota, id_negocio, registrada_por, id_usuario_registro };
  const columnas = Object.keys(campos);
  const [result] = await conn.query(
    `INSERT INTO vacunas (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_vacuna, data, conn) => {
  const campos = pick(data, CAMPOS_VACUNA);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await conn.query(`UPDATE vacunas SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_vacuna = ?`, [
    ...Object.values(campos),
    id_vacuna,
  ]);
};

/** Guarda el estado calculado de cada vacuna de la mascota (solo las que cambian). */
export const guardarEstados = async (cambios, conn) => {
  for (const [id_vacuna, estado] of cambios) {
    await conn.query("UPDATE vacunas SET estado = ? WHERE id_vacuna = ?", [estado, id_vacuna]);
  }
};

/**
 * Mascotas con alguna vacuna vigente cuyo estado guardado no corresponde a su fecha_proxima
 * hoy (misma regla que calcularEstados; `no_aplica` solo cambia al escribir).
 */
export const findMascotasConEstadoDesactualizado = async (hoy, diasAviso) => {
  const [rows] = await db.query(
    `SELECT DISTINCT id_mascota FROM vacunas
     WHERE estado <> 'no_aplica'
       AND estado <> CASE
         WHEN fecha_proxima IS NULL THEN 'al_dia'
         WHEN fecha_proxima < ? THEN 'vencido'
         WHEN fecha_proxima <= ? + INTERVAL ? DAY THEN 'proximo'
         ELSE 'al_dia'
       END
     ORDER BY id_mascota`,
    [hoy, hoy, diasAviso]
  );
  return rows.map((row) => row.id_mascota);
};

/** Borra las marcas de los recordatorios por hitos de la vacuna (cambió su fecha_proxima). */
export const reiniciarHitos = async (id_vacuna, conn) => {
  await conn.query("DELETE FROM recordatorios WHERE id_vacuna = ? AND hito IS NOT NULL", [id_vacuna]);
};

/** Registro de historial de ese negocio y esa mascota (para ligar la vacuna). */
export const historialDelNegocio = async (id_historial, id_negocio, id_mascota, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM historial_medico WHERE id_historial = ? AND id_negocio = ? AND id_mascota = ?",
    [id_historial, id_negocio, id_mascota]
  );
  return rows.length > 0;
};

/** Bloquea la mascota: serializa los cambios de sus vacunas (el estado depende de todas). */
export const lockMascota = async (id_mascota, conn) => {
  await conn.query("SELECT id_mascota FROM mascotas WHERE id_mascota = ? FOR UPDATE", [id_mascota]);
};
