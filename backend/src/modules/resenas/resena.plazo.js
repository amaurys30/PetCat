import * as resenaRepo from "./resena.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { configSilencio } from "../notificaciones/notificacion.service.js";
import { enSilencio, finDelSilencio } from "../notificaciones/silencio.js";
import { aDatetimeSQL, deDatetimeSQL } from "../../shared/utils/fechas.js";

/**
 * Plazo para reseñar e invitación a hacerlo (2.6). Ambos se cuentan desde
 * `citas.fecha_completada`.
 */

// Sin invitaciones desde una hora antes del silencio hasta 3 horas después de su fin
// (con el silencio de 21:00 a 07:00: de 20:00 a 10:00). A las 07:00 nadie reseña.
const ANTES_DEL_SILENCIO_MIN = 60;
const DESPUES_DEL_SILENCIO_MIN = 3 * 60;
const DIA_MIN = 24 * 60;

export const plazoDias = () => configuracionRepo.getValor("resena_plazo_dias", 30);
const horasInvitacion = () => configuracionRepo.getValor("resena_invitacion_h", 3);

/** Horario sin invitaciones a partir del horario de silencio (sin silencio, tampoco hay este). */
export const horarioSinInvitaciones = ({ inicio, fin }) =>
  inicio === fin
    ? { inicio, fin }
    : {
        inicio: (inicio - ANTES_DEL_SILENCIO_MIN + DIA_MIN) % DIA_MIN,
        fin: (fin + DESPUES_DEL_SILENCIO_MIN) % DIA_MIN,
      };

/** Cuándo invitar: `horas` después de completada; dentro del horario sin invitaciones, al terminar este. */
export const momentoInvitacion = (completada, horas, silencio) => {
  const momento = new Date(completada.getTime() + horas * 3_600_000);
  const sinInvitaciones = horarioSinInvitaciones(silencio);
  return enSilencio(momento, sinInvitaciones) ? finDelSilencio(momento, sinInvitaciones) : momento;
};

/** Hasta cuándo se puede reseñar o editar la reseña ("YYYY-MM-DD HH:MM:SS"), o null sin fecha_completada. */
export const resenarAntesDe = (fecha_completada, dias) => {
  if (!fecha_completada) return null;
  const limite = deDatetimeSQL(fecha_completada);
  limite.setDate(limite.getDate() + dias);
  return aDatetimeSQL(limite);
};

export const plazoAbierto = (antesDe, ahora) => antesDe !== null && aDatetimeSQL(ahora) < antesDe;

/**
 * Programa la invitación en la transacción que completa la cita (la clave única
 * (id_cita, tipo) la hace única). El job decide al enviarla si todavía corresponde.
 */
export const programarInvitacion = async (cita, completada, conn) => {
  const momento = momentoInvitacion(completada, await horasInvitacion(), await configSilencio());
  await resenaRepo.insertInvitacion(
    { id_cita: cita.id_cita, id_usuario: cita.id_usuario, id_mascota: cita.id_mascota, fecha: aDatetimeSQL(momento) },
    conn
  );
};

/**
 * Estado de la reseña de cada cita del dueño (misma posición que `rows`, filas de citaRepo):
 * null si la cita no está completada. `puede_resenar`: sin reseña, dentro del plazo y sin ser
 * personal del negocio; `puede_editar`: su reseña (no retirada) dentro del plazo.
 */
export const estadosResenaDueno = async (rows, id_usuario, ahora = new Date()) => {
  if (!rows.some((row) => row.estado === "completada")) return rows.map(() => null);
  const [dias, personal] = await Promise.all([plazoDias(), resenaRepo.findNegociosDelPersonal(id_usuario)]);
  return rows.map((row) => {
    if (row.estado !== "completada") return null;
    const antesDe = resenarAntesDe(row.fecha_completada, dias);
    const abierto = plazoAbierto(antesDe, ahora);
    const retirada = Boolean(row.resena_retirada_en);
    const tiene = row.id_resena !== null && row.id_resena !== undefined;
    return {
      id_resena: tiene && !retirada ? row.id_resena : null,
      retirada,
      resenar_antes_de: antesDe,
      puede_resenar: abierto && !tiene && !personal.has(row.id_negocio),
      puede_editar: abierto && tiene && !retirada,
    };
  });
};
