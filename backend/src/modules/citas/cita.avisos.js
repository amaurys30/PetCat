import * as citaRepo from "./cita.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { cruzaUmbralAviso } from "../suscripciones/suscripcion.service.js";
import { conNotificaciones, destinatariosDelNegocio, yaSeAviso } from "../notificaciones/notificacion.service.js";
import { aDatetimeSQL, hoyISO } from "../../shared/utils/fechas.js";

/**
 * Eventos de notificación de las citas y del límite del plan (2.3). Se arman al final
 * de la transacción del cambio, después de sus bloqueos y lecturas, y se pasan a
 * `notificar` (conNotificaciones): se envían solo si la transacción termina bien.
 */

const PERMISO_CITAS = ["citas", "ver"];
const PERMISO_PLAN = ["configuracion", "editar"];

const datosDeCita = (row) => ({
  fecha: row.fecha,
  hora_inicio: row.hora_inicio,
  negocio: row.negocio_nombre,
  sucursal: row.sucursal_nombre,
  direccion: row.sucursal_direccion,
  mascota: row.mascota_nombre,
  servicio: row.servicio_nombre,
  cliente: `${row.cliente_nombre} ${row.cliente_apellido}`,
  // Solo la usa el recordatorio del día anterior (en la app y el correo, no en la push).
  indicaciones: row.servicio_indicaciones_previas ?? null,
});

/**
 * Evento de una cita para el dueño (`para: "dueno"`) o para el personal del negocio con
 * `citas.ver` (`para: "negocio"`). `extra`: datos adicionales del tipo (motivo, fecha anterior...).
 * No se notifica a quien hizo el cambio (`actor`).
 */
export const eventoCita = async (tipo, id_cita, { para, actor, extra = {} }, conn) => {
  const row = await citaRepo.findDetalle(id_cita, conn);
  return {
    tipo,
    id_negocio: row.id_negocio,
    datos: { ...datosDeCita(row), ...extra },
    enlace: { id_cita, id_negocio: row.id_negocio },
    destinatarios:
      para === "dueno"
        ? [{ id_usuario: row.id_usuario, rol: "dueno" }]
        : await destinatariosDelNegocio(row.id_negocio, PERMISO_CITAS, conn),
    excluir: actor?.id_usuario,
  };
};

/**
 * Aviso del 80 % del límite de citas del mes: solo la reserva que cruza el umbral y una
 * vez por negocio y mes (si las cancelaciones lo bajan y se vuelve a cruzar, no se repite).
 * `limite` es el estado antes de esta reserva (`usadas` sin contarla).
 */
export const eventoUmbralPlan = async ({ id_negocio, fecha, limite, actor }, conn) => {
  if (!cruzaUmbralAviso(limite.usadas, limite.maximo)) return null;
  const mes = fecha.slice(0, 7);
  if (await yaSeAviso({ tipo: "plan_limite_80", id_negocio, mes }, conn)) return null;
  return {
    tipo: "plan_limite_80",
    id_negocio,
    datos: { usadas: limite.usadas + 1, maximo: limite.maximo, mes, plan: limite.plan.nombre },
    enlace: { id_negocio, mes },
    destinatarios: await destinatariosDelNegocio(id_negocio, PERMISO_PLAN, conn),
    excluir: actor?.id_usuario,
  };
};

/**
 * Reserva rechazada por el límite (su transacción se deshizo): se avisa en una
 * transacción aparte, como máximo una vez por negocio y día. Bloquea las suscripciones
 * del negocio (como la reserva) para que dos rechazos simultáneos no avisen dos veces.
 * Nunca lanza: el error de la reserva es lo que importa.
 */
export const avisarLimiteAlcanzado = async ({ id_negocio, mes, maximo, plan }, actor) => {
  try {
    await conNotificaciones(async (conn, notificar) => {
      await suscripcionRepo.lockByNegocio(id_negocio, conn);
      const desde = `${hoyISO()} 00:00:00`;
      if (await yaSeAviso({ tipo: "plan_limite_alcanzado", id_negocio, desde }, conn)) return;
      await notificar([
        {
          tipo: "plan_limite_alcanzado",
          id_negocio,
          datos: { maximo, mes, plan },
          enlace: { id_negocio, mes },
          destinatarios: await destinatariosDelNegocio(id_negocio, PERMISO_PLAN, conn),
          excluir: actor?.id_usuario,
        },
      ]);
    });
  } catch (err) {
    console.error(`[avisos] No se pudo avisar el límite del plan (negocio ${id_negocio}, ${aDatetimeSQL(new Date())}):`, err.message);
  }
};
