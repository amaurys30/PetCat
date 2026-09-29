import * as resenaRepo from "./resena.repository.js";
import * as recordatorioRepo from "../recordatorios/recordatorio.repository.js";
import { horarioSinInvitaciones, plazoAbierto, plazoDias, resenarAntesDe } from "./resena.plazo.js";
import { eventoCita } from "../citas/cita.avisos.js";
import { conNotificaciones, configSilencio } from "../notificaciones/notificacion.service.js";
import { enSilencio } from "../notificaciones/silencio.js";
import { aDatetimeSQL } from "../../shared/utils/fechas.js";

/**
 * Job de invitaciones a reseñar (2.6): los recordatorios `resena_invitacion` que programa la
 * transacción que completa la cita. La entrega (push, silencio, reintentos) es de notificar().
 */

const MAX_INTENTOS = 3;

/** Por qué ya no se invita, o null si corresponde. */
const motivoDescarte = async (cita, antesDe, ahora, conn) => {
  if (cita.estado !== "completada") return `La cita está ${cita.estado}`;
  if (!plazoAbierto(antesDe, ahora)) return "Terminó el plazo para reseñar";
  if (!cita.usuario_activo) return "El dueño está inactivo";
  if (!cita.negocio_activo) return "El negocio está inactivo";
  if (await resenaRepo.findByCita(cita.id_cita, conn)) return "Ya dejó su reseña";
  if (await resenaRepo.esPersonal(cita.id_usuario, cita.id_negocio, conn)) return "Es personal del negocio";
  return null;
};

/**
 * Una invitación en su propia transacción: bloquea la cita (sin esperar) y el recordatorio,
 * comprueba que siga pendiente y que aún corresponda, y avisa al dueño. El aviso y la marca
 * `enviado` van juntos: con dos instancias, la invitación sale una sola vez.
 */
const procesarInvitacion = ({ id_recordatorio, id_cita }, { ahora, dias }) =>
  conNotificaciones(
    async (conn, notificar) => {
      if (id_cita === null) {
        await recordatorioRepo.marcarCancelado(id_recordatorio, "La cita ya no existe", conn);
        return false;
      }
      const cita = await resenaRepo.lockCitaSinEsperar(id_cita, conn);
      if (!cita) return false; // la tiene otra transacción: se reintenta en la próxima corrida
      const recordatorio = await recordatorioRepo.lockRecordatorio(id_recordatorio, conn);
      if (recordatorio?.estado !== "pendiente") return false;

      const antesDe = resenarAntesDe(cita.fecha_completada, dias);
      const motivo = await motivoDescarte(cita, antesDe, ahora, conn);
      if (motivo) {
        await recordatorioRepo.marcarCancelado(id_recordatorio, motivo, conn);
        return false;
      }
      await notificar([await eventoCita("resena_invitacion", id_cita, { para: "dueno", extra: { resenar_antes_de: antesDe } }, conn)]);
      await recordatorioRepo.marcarEnviado(id_recordatorio, aDatetimeSQL(ahora), conn);
      return true;
    },
    { ahora }
  );

/**
 * Job (cada 5 minutos): invitaciones que ya tocan, programadas dentro del plazo para reseñar.
 * En el horario sin invitaciones (de 20:00 a 10:00) no hace nada: tras una caída, lo atrasado
 * sale a las 10:00. Un error suma un intento y a los 3 queda `fallido`. Devuelve cuántas envió.
 */
export const enviarInvitacionesResena = async ({ ahora = new Date(), limite = 200 } = {}) => {
  if (enSilencio(ahora, horarioSinInvitaciones(await configSilencio()))) return 0;
  const dias = await plazoDias();
  const pendientes = await resenaRepo.findInvitacionesPendientes({
    desde: aDatetimeSQL(new Date(ahora.getTime() - dias * 86_400_000)),
    hasta: aDatetimeSQL(ahora),
    limite,
  });
  let enviadas = 0;
  for (const invitacion of pendientes) {
    try {
      if (await procesarInvitacion(invitacion, { ahora, dias })) enviadas += 1;
    } catch (err) {
      console.error(`[resenas] Falló la invitación ${invitacion.id_recordatorio}:`, err.message);
      await recordatorioRepo.registrarFallo(invitacion.id_recordatorio, err.message, MAX_INTENTOS);
    }
  }
  return enviadas;
};
