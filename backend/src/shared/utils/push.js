import { Expo } from "expo-server-sdk";
import { env, isTest } from "../../config/env.js";

/**
 * Envío de notificaciones push. Dos implementaciones con la misma interfaz:
 * Expo Push Service y en memoria (tests).
 *
 *   enviar(mensajes)  -> tickets en el mismo orden: { status: "ok", id } | { status: "error", message, details }
 *   recibos(ids)      -> { [id_ticket]: { status: "ok" } | { status: "error", message, details } }
 *
 * Un ticket "ok" solo dice que Expo recibió el mensaje; el recibo (unos minutos después)
 * dice si llegó al servicio de Apple o Google. `details.error === "DeviceNotRegistered"`
 * significa que el token ya no sirve (app desinstalada o permisos retirados).
 */

const crearExpo = () => {
  const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN || undefined });
  return {
    enviar: async (mensajes) => {
      const tickets = [];
      for (const lote of expo.chunkPushNotifications(mensajes)) {
        tickets.push(...(await expo.sendPushNotificationsAsync(lote)));
      }
      return tickets;
    },
    recibos: async (ids) => {
      const resultado = {};
      for (const lote of expo.chunkPushNotificationReceiptIds(ids)) {
        Object.assign(resultado, await expo.getPushNotificationReceiptsAsync(lote));
      }
      return resultado;
    },
  };
};

/**
 * En memoria: guarda los mensajes en `enviados`. Los tests simulan tokens dados de baja
 * (`noRegistrados`), un fallo de red (`fallarAlEnviar`), recibos con error (`recibosConError`)
 * y la latencia de Expo (`retrasoMs`, para que dos procesadores se solapen).
 */
const crearMemoria = () => {
  let contador = 0;
  const memoria = {
    enviados: [],
    noRegistrados: new Set(),
    recibosConError: new Map(),
    fallarAlEnviar: false,
    retrasoMs: 0,

    enviar: async (mensajes) => {
      if (memoria.retrasoMs) await new Promise((r) => setTimeout(r, memoria.retrasoMs));
      if (memoria.fallarAlEnviar) throw new Error("Fallo simulado de Expo");
      return mensajes.map((mensaje) => {
        if (memoria.noRegistrados.has(mensaje.to)) {
          return { status: "error", message: "DeviceNotRegistered", details: { error: "DeviceNotRegistered" } };
        }
        memoria.enviados.push(mensaje);
        return { status: "ok", id: `ticket-${++contador}` };
      });
    },

    recibos: async (ids) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          memoria.recibosConError.has(id)
            ? { status: "error", message: memoria.recibosConError.get(id), details: { error: memoria.recibosConError.get(id) } }
            : { status: "ok" },
        ])
      ),

    reiniciar: () => {
      memoria.enviados.length = 0;
      memoria.noRegistrados.clear();
      memoria.recibosConError.clear();
      memoria.fallarAlEnviar = false;
      memoria.retrasoMs = 0;
    },
  };
  return memoria;
};

export const pushSender = isTest ? crearMemoria() : crearExpo();

export default pushSender;
