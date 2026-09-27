import db from "../../config/db.js";
import * as mascotaRepo from "../mascotas/mascota.repository.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Acceso a la salud de una mascota (historial, vacunas, resumen). Devuelve la
 * mascota y el contexto de visibilidad:
 * - { tipo: "dueno" }: ve todo lo suyo, sin notas internas.
 * - { tipo: "negocio", id_negocio, compartir }: ve las vacunas siempre y el
 *   historial clínico de otros negocios solo si compartir_historial es TRUE.
 */

/** La cita que da acceso a un negocio: cualquiera con la mascota salvo cancelada o reprogramada. */
export const tieneCitaValida = async (id_mascota, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT 1 FROM citas
     WHERE id_mascota = ? AND id_negocio = ? AND estado NOT IN ('cancelada', 'reprogramada')
     LIMIT 1`,
    [id_mascota, id_negocio]
  );
  return rows.length > 0;
};

/** Mascota activa del dueño: 404 si no existe o se eliminó; 403 si es de otro usuario. */
export const accesoDueno = async (id_usuario, id_mascota, { conn, forUpdate = false } = {}) => {
  const mascota = await mascotaRepo.findById(id_mascota, { conn, forUpdate });
  if (!mascota?.activo) throw ApiError.notFound("Mascota no encontrada");
  if (mascota.id_usuario !== id_usuario) throw ApiError.forbidden("No tienes acceso a esta mascota");
  return { mascota, contexto: { tipo: "dueno" } };
};

/**
 * Mascota activa con una cita válida con el negocio: 404 si no existe o el dueño la
 * eliminó; 403 si no tiene citas con el negocio.
 */
export const accesoNegocio = async (id_negocio, id_mascota, { conn, forUpdate = false } = {}) => {
  const mascota = await mascotaRepo.findById(id_mascota, { conn, forUpdate });
  if (!mascota?.activo) throw ApiError.notFound("Mascota no encontrada");
  if (!(await tieneCitaValida(id_mascota, id_negocio, conn))) {
    throw ApiError.forbidden("Esta mascota no tiene citas con el negocio");
  }
  return { mascota, contexto: { tipo: "negocio", id_negocio, compartir: Boolean(mascota.compartir_historial) } };
};

/** El registro de historial es visible en ese contexto (las vacunas siempre lo son). */
export const historialVisible = (contexto, id_negocio_registro) =>
  contexto.tipo === "dueno" || contexto.compartir || id_negocio_registro === contexto.id_negocio;
