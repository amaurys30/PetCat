import cron from "node-cron";
import { limpiarNotificaciones, procesarEnviosPendientes, revisarRecibos } from "../modules/notificaciones/notificacion.service.js";
import {
  enviarRecordatoriosCitas,
  enviarRecordatoriosVacunas,
  limpiarRecordatorios,
} from "../modules/recordatorios/recordatorio.service.js";
import { refrescarEstados as refrescarEstadosVacunas } from "../modules/vacunas/vacuna.service.js";
import { vencerSuscripciones } from "../modules/suscripciones/suscripcion.jobs.js";
import { limpiarSesiones } from "../modules/sessions/session.service.js";
import { reintentarEliminaciones } from "../modules/archivos/archivo.service.js";
import { procesarConfirmaciones } from "../modules/citas/cita.confirmacion.js";

/**
 * Tareas programadas (node-cron, hora de Bogotá). Cada job es una función exportada de
 * su módulo que los tests llaman directo; aquí solo se programa. server.js las inicia
 * (los tests importan app.js y nunca las arrancan). Todos son seguros con dos instancias
 * a la vez (p. ej. durante un despliegue).
 * `alArrancar`: jobs diarios idempotentes que también corren al iniciar el servidor, para
 * recuperar una ejecución perdida si estaba apagado a su hora.
 */
export const JOBS = [
  // Push y correos programados (fin del horario de silencio) y reintentos.
  { nombre: "envios-notificaciones", cada: "* * * * *", tarea: () => procesarEnviosPendientes() },
  // Recibos de Expo: tokens dados de baja y errores de entrega.
  { nombre: "recibos-expo", cada: "*/15 * * * *", tarea: () => revisarRecibos() },
  // Recordatorios de citas: el del día anterior (19:00) y el de 2 horas antes.
  { nombre: "recordatorios-citas", cada: "* * * * *", tarea: () => enviarRecordatoriosCitas() },
  // Citas pendientes: aviso al negocio a mitad del plazo y cancelación automática al vencer (2.5).
  { nombre: "confirmaciones", cada: "* * * * *", tarea: () => procesarConfirmaciones() },
  // Columna vacunas.estado (las vistas la usan; la API calcula el estado al leer).
  { nombre: "estado-vacunas", cada: "5 0 * * *", tarea: () => refrescarEstadosVacunas(), alArrancar: true },
  // Pruebas y planes vencidos pasan a `vencida` (plan_vencido) y aviso de prueba por terminar.
  { nombre: "suscripciones", cada: "10 0 * * *", tarea: () => vencerSuscripciones(), alArrancar: true },
  // Vacunas 7 días antes, el día y 7 días después de fecha_proxima (fuera del horario de silencio;
  // al arrancar de noche, push y correos esperan el fin del silencio).
  { nombre: "recordatorios-vacunas", cada: "0 9 * * *", tarea: () => enviarRecordatoriosVacunas(), alArrancar: true },
  // Reintento del borrado en Cloudinary de los archivos por_eliminar (2.2).
  { nombre: "archivos-por-eliminar", cada: "0 * * * *", tarea: () => reintentarEliminaciones() },
  // Sesiones vencidas hace más de 30 días y tokens de correo vencidos.
  { nombre: "sesiones", cada: "30 3 * * *", tarea: () => limpiarSesiones() },
  // Notificaciones leídas de más de 90 días, todas las de más de 180 y recordatorios viejos.
  {
    nombre: "limpieza-notificaciones",
    cada: "0 4 * * 0",
    tarea: async () => ({ notificaciones: await limpiarNotificaciones(), recordatorios: await limpiarRecordatorios() }),
  },
];

/** Corre una tarea sin dejar que un error detenga el proceso. */
const correr = async ({ nombre, tarea }) => {
  try {
    return await tarea();
  } catch (err) {
    console.error(`[jobs] ${nombre}:`, err.message);
    return undefined;
  }
};

/** Corre una vez, en orden, los jobs marcados `alArrancar`. Devuelve { nombre: resultado }. */
export const correrAlArrancar = async (jobs = JOBS) => {
  const resultados = {};
  for (const job of jobs.filter((j) => j.alArrancar)) resultados[job.nombre] = await correr(job);
  return resultados;
};

export const iniciarJobs = () => {
  const tareas = JOBS.map((job) =>
    // noOverlap: si una ejecución tarda más que el intervalo, la siguiente se salta.
    cron.schedule(job.cada, () => correr(job), { name: job.nombre, timezone: "America/Bogota", noOverlap: true })
  );
  // Sin esperar: el servidor ya atiende mientras tanto.
  correrAlArrancar();
  return tareas;
};
