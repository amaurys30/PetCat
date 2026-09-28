import * as recordatorioRepo from "./recordatorio.repository.js";
import * as vacunaRepo from "../vacunas/vacuna.repository.js";
import { eventoCita } from "../citas/cita.avisos.js";
import { calcularEstados, diasEntre } from "../vacunas/vacuna.calculo.js";
import { diasAvisoVacuna } from "../vacunas/vacuna.service.js";
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

// ---------- Vacunas ----------

/**
 * Hitos de los recordatorios de vacunas, en días respecto a fecha_proxima (fijos en el
 * código). `tipo` es el de la tabla recordatorios; `notificacion`, el del catálogo.
 */
export const HITOS_VACUNA = [
  { hito: -7, tipo: "vacuna_proxima", notificacion: "vacuna_proxima", titulo: "Vacuna próxima" },
  { hito: 0, tipo: "vacuna_proxima", notificacion: "vacuna_vence_hoy", titulo: "Vacuna para hoy" },
  { hito: 7, tipo: "vacuna_vencida", notificacion: "vacuna_vencida", titulo: "Vacuna vencida" },
];
// Días después del hito en que aún se envía (cubre una ejecución perdida, sin avisos retroactivos).
const GRACIA_DIAS = 2;

/**
 * Un hito de una vacuna en su propia transacción: bloquea la mascota, comprueba que la
 * mascota y el dueño sigan activos, que la dosis siga vigente y que el hito siga tocando
 * (la fecha pudo cambiar), y marca el hito con la clave única antes de notificar. Con dos
 * instancias, solo la que inserta la marca avisa. Devuelve true si notificó.
 */
const procesarHitoVacuna = ({ id_vacuna, id_mascota, hito }, { ahora, hoy, dias }) =>
  conNotificaciones(
    async (conn, notificar) => {
      const mascota = await recordatorioRepo.lockMascotaParaAviso(id_mascota, conn);
      if (!mascota?.activo || mascota.fallecido || !mascota.usuario_activo) return false;
      const vacunas = await vacunaRepo.findDeMascota(id_mascota, conn);
      const vacuna = vacunas.find((v) => v.id_vacuna === id_vacuna);
      if (!vacuna?.fecha_proxima || calcularEstados(vacunas, hoy, dias).get(id_vacuna) === "no_aplica") return false;
      const atraso = diasEntre(vacuna.fecha_proxima, hoy) - hito;
      if (atraso < 0 || atraso > GRACIA_DIAS) return false;

      const { tipo, notificacion, titulo } = HITOS_VACUNA.find((h) => h.hito === hito);
      const marcado = await recordatorioRepo.insertHitoVacuna(
        {
          id_usuario: mascota.id_usuario,
          id_mascota,
          id_vacuna,
          hito,
          tipo,
          titulo,
          mensaje: `${vacuna.nombre_vacuna} de ${mascota.nombre}: fecha próxima ${vacuna.fecha_proxima}`,
          fecha: aDatetimeSQL(ahora),
        },
        conn
      );
      if (!marcado) return false;
      await notificar([
        {
          tipo: notificacion,
          datos: { mascota: mascota.nombre, vacuna: vacuna.nombre_vacuna, fecha_proxima: vacuna.fecha_proxima },
          enlace: { id_mascota, id_vacuna },
          destinatarios: [{ id_usuario: mascota.id_usuario, rol: "dueno" }],
        },
      ]);
      return true;
    },
    { ahora }
  );

/**
 * Job diario (09:00, fuera del horario de silencio): recordatorios de vacunas 7 días antes
 * de fecha_proxima, el día y 7 días después, una vez cada uno; nunca un aviso diario. Un
 * error no deja marca: se reintenta en la siguiente corrida mientras dure la gracia.
 * Devuelve cuántos notificó.
 */
export const enviarRecordatoriosVacunas = async ({ ahora = new Date(), limite = 500 } = {}) => {
  const hoy = hoyISO(ahora);
  const dias = await diasAvisoVacuna();
  const pendientes = await recordatorioRepo.findHitosVacunasPendientes({
    hoy,
    hitos: HITOS_VACUNA.map((h) => h.hito),
    gracia: GRACIA_DIAS,
    limite,
  });
  let enviados = 0;
  for (const pendiente of pendientes) {
    try {
      if (await procesarHitoVacuna(pendiente, { ahora, hoy, dias })) enviados += 1;
    } catch (err) {
      console.error(`[recordatorios] Falló el hito ${pendiente.hito} de la vacuna ${pendiente.id_vacuna}:`, err.message);
    }
  }
  return enviados;
};
