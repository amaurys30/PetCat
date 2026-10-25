import * as citaRepo from "./cita.repository.js";
import { avisarAgenda } from "./agenda.tiempoReal.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { eventoCita } from "./cita.avisos.js";
import { conNotificaciones, configSilencio } from "../notificaciones/notificacion.service.js";
import { enSilencio, finDelSilencio, inicioDeCita } from "../notificaciones/silencio.js";
import { aDatetimeSQL, deDatetimeSQL } from "../../shared/utils/fechas.js";

/**
 * Plazo del negocio para confirmar una cita pendiente (2.5) y el job que avisa a mitad de
 * plazo y la cancela al vencer (cancelada_por = 'sistema').
 */

const MINUTO = 60_000;
// Si el plazo cae de madrugada se corre hasta esta hora después del fin del silencio...
export const TRAS_SILENCIO_MIN = 60;
// ...pero nunca más tarde que estos minutos antes del inicio de la cita.
export const TOPE_ANTES_INICIO_MIN = 30;

/** Configuración del plazo: horas, minutos antes del inicio y horario de silencio. */
export const configConfirmacion = async () => ({
  plazoH: await configuracionRepo.getValor("plazo_confirmacion_h", 24),
  antesInicioMin: await configuracionRepo.getValor("confirmacion_antes_inicio_min", 60),
  silencio: await configSilencio(),
});

/**
 * Lo que ocurra primero entre `creacion` + `plazoH` e `inicio` − `antesInicioMin`. Si ese
 * momento cae entre el inicio del silencio y su fin + 60 min (nadie confirma de
 * madrugada), se corre al fin del silencio + 60 min, sin pasar de `inicio` − 30 min.
 * La ventana llega hasta el fin + 60 (y no solo al fin) para que la regla sea monótona:
 * un plazo de 06:59 no debe terminar después que uno de 07:15. Nunca antes de `creacion`.
 * @param {{ creacion: Date, inicio: Date, plazoH: number, antesInicioMin: number,
 *   silencio: { inicio: number, fin: number } }} p  Silencio en minutos del día
 * @returns {Date}
 */
export const calcularPlazoConfirmacion = ({ creacion, inicio, plazoH, antesInicioMin, silencio }) => {
  let plazo = new Date(Math.min(creacion.getTime() + plazoH * 60 * MINUTO, inicio.getTime() - antesInicioMin * MINUTO));
  if (silencio.inicio !== silencio.fin) {
    const ventana = { inicio: silencio.inicio, fin: (silencio.fin + TRAS_SILENCIO_MIN) % 1440 };
    if (enSilencio(plazo, ventana)) {
      const corrido = finDelSilencio(plazo, ventana);
      plazo = new Date(Math.min(corrido.getTime(), inicio.getTime() - TOPE_ANTES_INICIO_MIN * MINUTO));
    }
  }
  return new Date(Math.max(plazo.getTime(), creacion.getTime()));
};

// ---------- Job de confirmaciones (cada minuto) ----------

export const MOTIVO_SISTEMA = "El negocio no confirmó la cita a tiempo";

/** Punto medio entre la creación y el plazo: cuándo se avisa al negocio. */
const mitadDelPlazo = (cita) => {
  const creacion = deDatetimeSQL(cita.fecha_creacion).getTime();
  return new Date(creacion + (deDatetimeSQL(cita.confirmar_antes_de).getTime() - creacion) / 2);
};

/**
 * Aviso de mitad de plazo en su propia transacción: bloquea la cita (sin esperar), comprueba
 * que siga pendiente, sin avisar y con el plazo vigente, y marca `aviso_por_confirmar_en` en la
 * misma transacción que notifica: con dos instancias, un solo aviso. Al propietario y a quien
 * tiene `citas.editar` (quien puede confirmar); nunca urgente. Devuelve true si avisó.
 */
const avisarPorConfirmar = (id_cita, { ahora }) =>
  conNotificaciones(
    async (conn, notificar) => {
      const cita = await citaRepo.lockCitaSinEsperar(id_cita, conn);
      if (!cita || cita.estado !== "pendiente" || cita.aviso_por_confirmar_en || !cita.confirmar_antes_de) return false;
      if (deDatetimeSQL(cita.confirmar_antes_de) <= ahora || mitadDelPlazo(cita) > ahora) return false;

      await citaRepo.marcarAvisoPorConfirmar(id_cita, aDatetimeSQL(ahora), conn);
      await notificar([
        await eventoCita(
          "cita_por_confirmar",
          id_cita,
          { para: "negocio", permiso: ["citas", "editar"], extra: { plazo: cita.confirmar_antes_de } },
          conn
        ),
      ]);
      return true;
    },
    { ahora }
  );

/**
 * Cancelación automática en su propia transacción, con la cita bloqueada (sin esperar): si
 * sigue pendiente con el plazo vencido pasa a cancelada por el sistema (nunca tardía), queda
 * en su historial sin usuario ni empleado y se cancelan sus recordatorios. Si la cita aún no
 * empezó, avisa al dueño (con los ids para reservar de nuevo; urgente si la cita está cerca) y
 * al negocio. Si el negocio la confirmó a la vez, gana quien bloqueó primero. Devuelve true si canceló.
 */
const cancelarSinConfirmar = async (id_cita, { ahora }) => {
  const cancelada = await conNotificaciones(
    async (conn, notificar) => {
      const cita = await citaRepo.lockCitaSinEsperar(id_cita, conn);
      if (!cita || cita.estado !== "pendiente" || !cita.confirmar_antes_de) return null;
      if (deDatetimeSQL(cita.confirmar_antes_de) > ahora) return null;

      await citaRepo.cancelarPorSistema(id_cita, { motivo: MOTIVO_SISTEMA, fecha: aDatetimeSQL(ahora) }, conn);
      await citaRepo.insertHistorial(
        { id_cita, actor: { id_usuario: null }, campo: "estado", anterior: "pendiente", nuevo: "cancelada", motivo: MOTIVO_SISTEMA },
        conn
      );
      await citaRepo.cancelarRecordatoriosPendientes(id_cita, conn);

      // Tras una caída larga, una cita que ya empezó se cancela sin avisar a nadie.
      if (inicioDeCita(cita.fecha, cita.hora_inicio) > ahora) {
        const reservaDeNuevo = { id_sucursal: cita.id_sucursal, id_servicio: cita.id_servicio, id_mascota: cita.id_mascota };
        await notificar([
          await eventoCita("cita_no_confirmada", id_cita, { para: "dueno", extra: { destino: "dueno" }, enlace: reservaDeNuevo }, conn),
          await eventoCita("cita_no_confirmada", id_cita, { para: "negocio" }, conn),
        ]);
      }
      return cita;
    },
    { ahora }
  );
  if (!cancelada) return false;
  await avisarAgenda(
    cancelada.id_negocio,
    { accion: "cancelada", id_cita, fechas: [cancelada.fecha], por: null },
    { empleados: [cancelada.id_empleado] }
  );
  return true;
};

/**
 * Job de cada minuto: primero los avisos de mitad de plazo y después las cancelaciones de
 * las citas pendientes cuyo plazo venció. Un error en una cita no detiene las demás.
 * Devuelve cuántos avisos y cancelaciones hizo.
 */
export const procesarConfirmaciones = async ({ ahora = new Date(), limite = 200 } = {}) => {
  const total = { avisos: 0, canceladas: 0 };
  const momento = aDatetimeSQL(ahora);
  for (const id_cita of await citaRepo.findPorAvisarConfirmacion(momento, limite)) {
    try {
      if (await avisarPorConfirmar(id_cita, { ahora })) total.avisos += 1;
    } catch (err) {
      console.error(`[confirmaciones] No se pudo avisar la cita ${id_cita}:`, err.message);
    }
  }
  for (const id_cita of await citaRepo.findConfirmacionVencida(momento, limite)) {
    try {
      if (await cancelarSinConfirmar(id_cita, { ahora })) total.canceladas += 1;
    } catch (err) {
      console.error(`[confirmaciones] No se pudo cancelar la cita ${id_cita}:`, err.message);
    }
  }
  return total;
};
