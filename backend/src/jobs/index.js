import cron from "node-cron";
import { procesarEnviosPendientes, revisarRecibos } from "../modules/notificaciones/notificacion.service.js";
import { enviarRecordatoriosCitas } from "../modules/recordatorios/recordatorio.service.js";

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
