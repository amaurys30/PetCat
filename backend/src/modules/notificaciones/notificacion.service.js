import * as notificacionRepo from "./notificacion.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { TIPOS } from "./notificacion.tipos.js";
import { finDelSilencio, programarEnvio, silencioDe } from "./silencio.js";
import { correoNotificacion } from "./notificacion.correo.js";
import { pushSender } from "../../shared/utils/push.js";
import { sendMail } from "../../shared/utils/mailer.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { aDatetimeSQL } from "../../shared/utils/fechas.js";

/**
 * Notificaciones con outbox:
 * 1. `notificar(eventos, conn)` corre dentro de la transacción del cambio (una cita, por
 *    ejemplo): guarda una notificación por destinatario y sus envíos (push por dispositivo
 *    o correo), programados para ahora o para el fin del horario de silencio.
 * 2. Después del commit, `despachar` emite por Socket.IO y procesa los envíos que ya tocan.
 *    Un fallo al enviar no rompe la respuesta: el envío sigue pendiente.
 * 3. El job (`procesarEnviosPendientes`, cada minuto) envía los programados y reintenta.
 * `conNotificaciones` junta 1 y 2.
 */

const MINUTO = 60_000;
const APARTADO_MIN = 5; // mientras un envío se procesa, nadie más lo toma
const MAX_INTENTOS = 5;
const ESPERAS_MIN = [1, 5, 15, 60]; // antes del 2.º, 3.º, 4.º y 5.º intento
const RECIBO_TRAS_MIN = 15; // Expo recomienda revisar los recibos unos minutos después
const RECIBO_VIGENCIA_H = 24; // Expo guarda los recibos 24 horas

const sumarMin = (fecha, min) => new Date(fecha.getTime() + min * MINUTO);

// Socket.IO registra aquí cómo emitir (2.3); sin él, solo se guarda y se envía por push o correo.
let emisor = () => {};
export const registrarEmisor = (fn) => {
  emisor = fn;
};

export const configSilencio = async () =>
  silencioDe({
    inicio: await configuracionRepo.getValor("silencio_inicio", "21:00"),
    fin: await configuracionRepo.getValor("silencio_fin", "07:00"),
  });

// Si un usuario es propietario y además empleado, cuenta como propietario.
const PRIORIDAD_ROL = { propietario: 2, dueno: 1, personal: 0 };

/** Un destinatario por usuario (el rol de más prioridad), sin quien hizo la acción. */
const unicos = (destinatarios, excluir) => {
  const porUsuario = new Map();
  for (const d of destinatarios) {
    if (d.id_usuario === excluir) continue;
    const actual = porUsuario.get(d.id_usuario);
    if (!actual || PRIORIDAD_ROL[d.rol] > PRIORIDAD_ROL[actual.rol]) porUsuario.set(d.id_usuario, d);
  }
  return [...porUsuario.values()];
};

/**
 * Guarda las notificaciones de los eventos dentro de la transacción `conn`. Va al final de
 * la transacción (después de los bloqueos y lecturas del cambio).
 * @param {Array<{ tipo: string, id_negocio?: number, datos: object, enlace?: object,
 *   destinatarios: Array<{ id_usuario: number, rol: "dueno"|"propietario"|"personal" }>, excluir?: number }>} eventos
 *   `datos`: lo que usan los textos del tipo; `enlace`: los ids del deep link (lo único que viaja en la push);
 *   `excluir`: quien hizo la acción (no se notifica a sí mismo).
 * @returns {Promise<object[]>} Notificaciones creadas, para `despachar` después del commit
 */
export const notificar = async (eventos, conn, { ahora = new Date() } = {}) => {
  const silencio = await configSilencio();
  const creadas = [];

  for (const evento of eventos) {
    const tipo = TIPOS[evento.tipo];
    if (!tipo) throw new Error(`Tipo de notificación desconocido: ${evento.tipo}`);
    const destinatarios = unicos(evento.destinatarios, evento.excluir);
    const ids = destinatarios.map((d) => d.id_usuario);
    const [usuarios, dispositivos] = await Promise.all([
      notificacionRepo.findDestinatarios(ids, conn),
      notificacionRepo.findDispositivosActivos(ids, conn),
    ]);
    const urgente = (fin) => tipo.urgente?.(evento.datos, fin) ?? false;
    const programado = programarEnvio(ahora, silencio, urgente);
    // Urgente también define la prioridad de la push (alta: suena aunque el teléfono ahorre batería).
    const esUrgente = urgente(finDelSilencio(ahora, silencio));

    for (const destinatario of destinatarios) {
      const usuario = usuarios[destinatario.id_usuario];
      if (!usuario?.activo) continue;
      const contenido = tipo.contenido(evento.datos, destinatario.rol === "dueno" ? "dueno" : "negocio");
      const enlace = { tipo: evento.tipo, ...(evento.enlace ?? {}) };
      const id_notificacion = await notificacionRepo.createNotificacion(
        {
          id_usuario: usuario.id_usuario,
          id_negocio: evento.id_negocio,
          tipo: evento.tipo,
          titulo: contenido.titulo,
          mensaje: contenido.mensaje,
          datos: {
            enlace,
            push: { titulo: contenido.titulo, cuerpo: contenido.push },
            correo: contenido.correo ?? null,
            urgente: esUrgente,
          },
        },
        conn
      );

      // Canales: push a cada dispositivo activo (si quiere push); sin dispositivos, correo
      // si el tipo lo admite para su rol y quiere correos.
      const suyos = dispositivos[usuario.id_usuario] ?? [];
      const envios = [];
      const programado_para = aDatetimeSQL(programado);
      if (suyos.length > 0) {
        if (usuario.notif_push) {
          for (const d of suyos) {
            envios.push({ canal: "push", id_dispositivo: d.id_dispositivo });
          }
        }
      } else if (usuario.notif_email && usuario.email && contenido.correo && tipo.correo.includes(destinatario.rol)) {
        envios.push({ canal: "email" });
      }
      for (const envio of envios) {
        envio.id_envio = await notificacionRepo.createEnvio({ id_notificacion, ...envio, programado_para }, conn);
        envio.programado = programado;
      }

      creadas.push({
        id_usuario: usuario.id_usuario,
        envios,
        notificacion: {
          id_notificacion,
          tipo: evento.tipo,
          titulo: contenido.titulo,
          mensaje: contenido.mensaje,
          datos: enlace,
          leida: false,
          fecha_creacion: aDatetimeSQL(ahora),
        },
      });
    }
  }
  return creadas;
};

/**
 * Después del commit: emite cada notificación por Socket.IO y envía los push y correos que
 * ya tocan (los del horario de silencio quedan para el job). Nunca lanza.
 */
export const despachar = async (creadas, { ahora = new Date() } = {}) => {
  for (const { id_usuario, notificacion, envios } of creadas) {
    try {
      emisor(id_usuario, notificacion);
    } catch (err) {
      console.error("[notificaciones] Error al emitir por Socket.IO:", err.message);
    }
    for (const envio of envios) {
      if (envio.programado <= ahora) await procesarEnvio(envio.id_envio, { ahora });
    }
  }
};

/**
 * Transacción con notificaciones: `fn(conn, notificar)` hace el cambio y llama a
 * `notificar(eventos)` (normalmente al final); tras el commit se despacha. Si la
 * transacción falla no queda ninguna notificación ni se envía nada.
 */
export const conNotificaciones = async (fn) => {
  const creadas = [];
  const resultado = await withTransaction((conn) =>
    fn(conn, async (eventos) => {
      creadas.push(...(await notificar(eventos, conn)));
    })
  );
  await despachar(creadas);
  return resultado;
};

/** Notifica en su propia transacción (p. ej. el aviso de una reserva que se rechazó y se deshizo). */
export const notificarAparte = (eventos) => conNotificaciones((conn, notificarEn) => notificarEn(eventos));

// ---------- Envíos ----------

const parse = (json) => (typeof json === "string" ? JSON.parse(json) : json);

const enviarPush = async (envio, datos) => {
  if (!envio.usuario_activo || !envio.notif_push || !envio.dispositivo_activo) {
    return notificacionRepo.marcarFinal(envio.id_envio, "omitido", "Dispositivo inactivo o push desactivadas");
  }
  const [ticket] = await pushSender.enviar([
    {
      to: envio.token_expo,
      title: datos.push.titulo,
      body: datos.push.cuerpo,
      data: { ...datos.enlace, id_notificacion: envio.id_notificacion },
      sound: "default",
      priority: datos.urgente ? "high" : "default",
    },
  ]);
  if (ticket.status === "ok") return notificacionRepo.marcarEnviado(envio.id_envio, { ticket: ticket.id });
  if (ticket.details?.error === "DeviceNotRegistered") {
    await notificacionRepo.desactivarDispositivo(envio.id_dispositivo, "DeviceNotRegistered");
    return notificacionRepo.marcarFinal(envio.id_envio, "omitido", "DeviceNotRegistered: el token ya no es válido");
  }
  throw new Error(ticket.message ?? "Expo rechazó la notificación");
};

const enviarCorreo = async (envio, datos) => {
  if (!envio.usuario_activo || !envio.notif_email || !envio.email || !datos.correo) {
    return notificacionRepo.marcarFinal(envio.id_envio, "omitido", "Correos desactivados o sin email");
  }
  await sendMail(
    correoNotificacion({ id_usuario: envio.id_usuario, nombre: envio.nombre, email: envio.email, ...datos.correo })
  );
  return notificacionRepo.marcarEnviado(envio.id_envio);
};

/**
 * Envía un push o un correo. Revisa las preferencias y el dispositivo en el momento del
 * envío (pudieron cambiar durante el silencio). Si falla, reintenta más tarde; tras
 * MAX_INTENTOS queda `fallido`. Nunca lanza.
 */
export const procesarEnvio = async (id_envio, { ahora = new Date() } = {}) => {
  try {
    if (!(await notificacionRepo.reclamarEnvio(id_envio, aDatetimeSQL(ahora), aDatetimeSQL(sumarMin(ahora, APARTADO_MIN))))) {
      return;
    }
    const envio = await notificacionRepo.findEnvio(id_envio);
    const datos = parse(envio.datos_extra_json);
    try {
      await (envio.canal === "push" ? enviarPush(envio, datos) : enviarCorreo(envio, datos));
    } catch (err) {
      console.error(`[notificaciones] Falló el envío ${id_envio} (${envio.canal}, intento ${envio.intentos}):`, err.message);
      if (envio.intentos >= MAX_INTENTOS) await notificacionRepo.marcarFinal(id_envio, "fallido", err.message);
      else await notificacionRepo.reprogramar(id_envio, aDatetimeSQL(sumarMin(ahora, ESPERAS_MIN[envio.intentos - 1])), err.message);
    }
  } catch (err) {
    console.error(`[notificaciones] Error al procesar el envío ${id_envio}:`, err.message);
  }
};

/** Job de cada minuto: envíos pendientes a los que ya les toca. Devuelve cuántos procesó. */
export const procesarEnviosPendientes = async ({ ahora = new Date(), limite = 200 } = {}) => {
  const ids = await notificacionRepo.findPendientesVencidos(aDatetimeSQL(ahora), limite);
  for (const id of ids) await procesarEnvio(id, { ahora });
  return ids.length;
};

/**
 * Job de recibos de Expo: los tickets enviados hace más de 15 minutos. Un recibo con
 * DeviceNotRegistered desactiva el dispositivo; sin recibo después de 24 horas se da por cerrado.
 */
export const revisarRecibos = async ({ ahora = new Date(), limite = 500 } = {}) => {
  const filas = await notificacionRepo.findRecibosPendientes(aDatetimeSQL(sumarMin(ahora, -RECIBO_TRAS_MIN)), limite);
  if (filas.length === 0) return 0;
  const recibos = await pushSender.recibos(filas.map((f) => f.ticket_expo));
  const vencido = sumarMin(ahora, -RECIBO_VIGENCIA_H * 60);
  for (const fila of filas) {
    const recibo = recibos[fila.ticket_expo];
    if (!recibo) {
      if (new Date(fila.fecha_envio) < vencido) await notificacionRepo.cerrarRecibo(fila.id_envio);
      continue;
    }
    if (recibo.status === "ok") {
      await notificacionRepo.cerrarRecibo(fila.id_envio);
      continue;
    }
    if (recibo.details?.error === "DeviceNotRegistered" && fila.id_dispositivo) {
      await notificacionRepo.desactivarDispositivo(fila.id_dispositivo, "DeviceNotRegistered");
    }
    await notificacionRepo.cerrarRecibo(fila.id_envio, recibo.message ?? recibo.details?.error ?? "Error de Expo");
  }
  return filas.length;
};

/** Baja de correos desde el enlace firmado. */
export const darDeBajaCorreos = (id_usuario) => notificacionRepo.desactivarCorreos(id_usuario);
