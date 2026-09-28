import cron from "node-cron";
import { procesarEnviosPendientes, revisarRecibos } from "../modules/notificaciones/notificacion.service.js";
import { enviarRecordatoriosCitas, enviarRecordatoriosVacunas } from "../modules/recordatorios/recordatorio.service.js";
import { refrescarEstados as refrescarEstadosVacunas } from "../modules/vacunas/vacuna.service.js";

/**
 * Tareas programadas (node-cron, hora de Bogotá). Cada job es una función exportada de
 * su módulo que los tests llaman directo; aquí solo se programa. server.js las inicia
 * (los tests importan app.js y nunca las arrancan). Un solo proceso: no correr a la vez
 * el contenedor backend y `npm run dev` contra la misma base.
 */
export const JOBS = [
  // Push y correos programados (fin del horario de silencio) y reintentos.
  { nombre: "envios-notificaciones", cada: "* * * * *", tarea: () => procesarEnviosPendientes() },
  // Recibos de Expo: tokens dados de baja y errores de entrega.
  { nombre: "recibos-expo", cada: "*/15 * * * *", tarea: () => revisarRecibos() },
  // Recordatorios de citas: el del día anterior (19:00) y el de 2 horas antes.
  { nombre: "recordatorios-citas", cada: "* * * * *", tarea: () => enviarRecordatoriosCitas() },
  // Columna vacunas.estado (las vistas la usan; la API calcula el estado al leer).
  { nombre: "estado-vacunas", cada: "5 0 * * *", tarea: () => refrescarEstadosVacunas() },
  // Vacunas 7 días antes, el día y 7 días después de fecha_proxima (fuera del horario de silencio).
  { nombre: "recordatorios-vacunas", cada: "0 9 * * *", tarea: () => enviarRecordatoriosVacunas() },
];

export const iniciarJobs = () =>
  JOBS.map(({ nombre, cada, tarea }) =>
    cron.schedule(
      cada,
      async () => {
        try {
          await tarea();
        } catch (err) {
          console.error(`[jobs] ${nombre}:`, err.message);
        }
      },
      // noOverlap: si una ejecución tarda más que el intervalo, la siguiente se salta.
      { name: nombre, timezone: "America/Bogota", noOverlap: true }
    )
  );
