import * as recordatorioRepo from "./recordatorio.repository.js";
import { eventoCita } from "../citas/cita.avisos.js";
import { conNotificaciones, configSilencio } from "../notificaciones/notificacion.service.js";
import { enSilencio, inicioDeCita } from "../notificaciones/silencio.js";
import { aDatetimeSQL, hoyISO } from "../../shared/utils/fechas.js";

/**
 * Jobs de recordatorios (2.4). La tabla `recordatorios` es la programación; la entrega
 * (push o correo, silencio, reintentos) es de `notificar()` y su outbox.
 */

const MAX_INTENTOS = 3;
// Un recordatorio con más atraso ya no sirve: la cita empezó o el del día anterior caducó.
const VENTANA_H = 24;

/** Por qué ya no se envía un recordatorio de cita, o null si corresponde enviarlo. */
const motivoDescarte = (tipo, cita, ahora, silencio) => {
  if (cita.estado !== "confirmada") return `La cita está ${cita.estado}`;
  if (inicioDeCita(cita.fecha, cita.hora_inicio) <= ahora) return "La cita ya empezó";
  // Tras una caída del servidor: el del día anterior no sale de noche ni el mismo día (lo cubre el de 2 horas antes).
  if (tipo === "cita_dia_anterior" && (hoyISO(ahora) >= cita.fecha || enSilencio(ahora, silencio))) {
    return "Llegó tarde: lo cubre el recordatorio de 2 horas antes";
  }
  return null;
};

/**
 * Un recordatorio en su propia transacción: bloquea la cita (sin esperar) y luego el
 * recordatorio, comprueba que siga pendiente y que la cita siga confirmada y futura, y
 * notifica al dueño. La notificación y la marca `enviado` van juntas: con dos instancias
 * del job, el aviso se crea una sola vez. Devuelve true si notificó.
 */
const procesarRecordatorioCita = ({ id_recordatorio, id_cita }, { ahora, silencio }) =>
  conNotificaciones(
    async (conn, notificar) => {
      if (id_cita === null) {
        await recordatorioRepo.marcarCancelado(id_recordatorio, "La cita ya no existe", conn);
        return false;
      }
      const cita = await recordatorioRepo.lockCitaSinEsperar(id_cita, conn);
      if (!cita) return false; // la tiene otra transacción: se reintenta en el próximo minuto
      const recordatorio = await recordatorioRepo.lockRecordatorio(id_recordatorio, conn);
      if (recordatorio?.estado !== "pendiente") return false;

      const motivo = motivoDescarte(recordatorio.tipo, cita, ahora, silencio);
      if (motivo) {
        await recordatorioRepo.marcarCancelado(id_recordatorio, motivo, conn);
        return false;
      }
      await notificar([await eventoCita(recordatorio.tipo, id_cita, { para: "dueno" }, conn)]);
      await recordatorioRepo.marcarEnviado(id_recordatorio, aDatetimeSQL(ahora), conn);
      if (recordatorio.tipo === "cita_recordatorio") await recordatorioRepo.marcarCitaRecordada(id_cita, conn);
      return true;
    },
    { ahora }
  );

/**
 * Job de cada minuto: recordatorios de citas (`cita_dia_anterior` y `cita_recordatorio`)
 * que ya tocan, con hasta 24 horas de atraso. Un error suma un intento y a los 3 queda
 * `fallido`. Devuelve cuántos notificó.
 */
export const enviarRecordatoriosCitas = async ({ ahora = new Date(), limite = 200 } = {}) => {
  const silencio = await configSilencio();
  const pendientes = await recordatorioRepo.findPendientesDeCitas({
    desde: aDatetimeSQL(new Date(ahora.getTime() - VENTANA_H * 3_600_000)),
    hasta: aDatetimeSQL(ahora),
    limite,
  });
  let enviados = 0;
  for (const recordatorio of pendientes) {
    try {
      if (await procesarRecordatorioCita(recordatorio, { ahora, silencio })) enviados += 1;
    } catch (err) {
      console.error(`[recordatorios] Falló el recordatorio ${recordatorio.id_recordatorio}:`, err.message);
      await recordatorioRepo.registrarFallo(recordatorio.id_recordatorio, err.message, MAX_INTENTOS);
    }
  }
  return enviados;
};
