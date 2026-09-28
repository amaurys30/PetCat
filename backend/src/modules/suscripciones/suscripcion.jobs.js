import * as suscripcionRepo from "./suscripcion.repository.js";
import * as negocioRepo from "../negocios/negocio.repository.js";
import { esVigente, estaVencida } from "./suscripcion.service.js";
import { conNotificaciones, destinatariosDelNegocio, yaSeAviso } from "../notificaciones/notificacion.service.js";
import { diasEntre, hoyISO } from "../../shared/utils/fechas.js";

/**
 * Job de suscripciones (2.4, 00:10). El plan efectivo ya se calcula al leer (una prueba o
 * un plan vencido cuenta como Gratuito); este job guarda `vencida` y avisa al negocio.
 */

// La prueba avisa cuando le quedan estos días o menos (una vez por negocio).
const DIAS_AVISO_PRUEBA = 3;
const PERMISO_PLAN = ["configuracion", "editar"];

/**
 * Un negocio en su propia transacción, con sus suscripciones bloqueadas (el mismo bloqueo
 * que la reserva, la prueba y la asignación de plan):
 * - cada suscripción vigente vencida pasa a `vencida`; si era la vigente del negocio y no
 *   era Gratuito, `plan_vencido` en la misma transacción (el cambio de estado lo hace una sola vez);
 * - si la vigente es una prueba a la que le quedan 3 días o menos, `plan_prueba_por_vencer`,
 *   una vez por negocio (la prueba se usa una sola vez).
 * Avisos al propietario y a quien tiene `configuracion.editar`; el propietario sin
 * dispositivo los recibe por correo.
 */
const revisarNegocio = (id_negocio, { ahora, hoy }) =>
  conNotificaciones(
    async (conn, notificar) => {
      const suscripciones = await suscripcionRepo.lockByNegocio(id_negocio, conn);
      const vigente = suscripciones.findLast(esVigente);
      const avisos = [];
      let vencidas = 0;

      for (const suscripcion of suscripciones.filter(esVigente)) {
        if (!estaVencida(suscripcion, hoy)) continue;
        await suscripcionRepo.cerrar(suscripcion, true, conn);
        vencidas += 1;
        const plan = await suscripcionRepo.findPlanById(suscripcion.id_plan, conn);
        if (suscripcion === vigente && plan.nombre !== "Gratuito") {
          avisos.push({ tipo: "plan_vencido", datos: { plan: plan.nombre, prueba: suscripcion.estado === "en_prueba" } });
        }
      }

      if (vigente?.estado === "en_prueba" && !estaVencida(vigente, hoy)) {
        const dias = diasEntre(hoy, vigente.fecha_prueba_fin);
        if (dias <= DIAS_AVISO_PRUEBA && !(await yaSeAviso({ tipo: "plan_prueba_por_vencer", id_negocio }, conn))) {
          const plan = await suscripcionRepo.findPlanById(vigente.id_plan, conn);
          avisos.push({ tipo: "plan_prueba_por_vencer", datos: { plan: plan.nombre, dias, fecha_fin: vigente.fecha_prueba_fin } });
        }
      }

      const negocio = avisos.length > 0 ? await negocioRepo.findById(id_negocio, conn) : null;
      // Un negocio desactivado queda al día en la base, pero sin avisos.
      if (negocio?.activo) {
        const destinatarios = await destinatariosDelNegocio(id_negocio, PERMISO_PLAN, conn);
        await notificar(
          avisos.map(({ tipo, datos }) => ({
            tipo,
            id_negocio,
            datos: { ...datos, negocio: negocio.nombre },
            enlace: { id_negocio },
            destinatarios,
          }))
        );
      }
      return { vencidas, avisos: negocio?.activo ? avisos.length : 0 };
    },
    { ahora }
  );

/**
 * Revisa los negocios con una suscripción vencida o una prueba por vencer. Con dos
 * instancias, la segunda espera el bloqueo del negocio y ya no encuentra nada que hacer.
 * Devuelve cuántas suscripciones venció y cuántos avisos creó.
 */
export const vencerSuscripciones = async ({ ahora = new Date(), limite = 500 } = {}) => {
  const hoy = hoyISO(ahora);
  const ids = await suscripcionRepo.findNegociosPorRevisar(hoy, DIAS_AVISO_PRUEBA, limite);
  const total = { vencidas: 0, avisos: 0 };
  for (const id_negocio of ids) {
    try {
      const { vencidas, avisos } = await revisarNegocio(id_negocio, { ahora, hoy });
      total.vencidas += vencidas;
      total.avisos += avisos;
    } catch (err) {
      console.error(`[suscripciones] No se pudo revisar el negocio ${id_negocio}:`, err.message);
    }
  }
  return total;
};
