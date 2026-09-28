import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { pool } from "../../src/config/db.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { withTransaction } from "../../src/shared/utils/transaction.js";
import { aDatetimeSQL } from "../../src/shared/utils/fechas.js";
import {
  conNotificaciones,
  despachar,
  notificar,
  procesarEnviosPendientes,
  revisarRecibos,
} from "../../src/modules/notificaciones/notificacion.service.js";
import { tokenBaja } from "../../src/modules/notificaciones/notificacion.correo.js";
import { enSilencio, finDelSilencio, silencioDe } from "../../src/modules/notificaciones/silencio.js";
import { configurarSilencio, crearDispositivo, crearUsuario, sinSilencio, tokenDe } from "../helpers/factories.js";

// Sin silencio salvo en su describe: los envíos inmediatos no dependen de la hora a la que corre la suite.
beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await sinSilencio();
});
afterEach(() => pushSender.reiniciar());

/** Cita cancelada por el negocio para `fecha` a `hora` (datos como los arma la 2.3 para citas). */
const cancelada = (dueno, { fecha = "2026-10-12", hora = "09:00:00", excluir } = {}) => ({
  tipo: "cita_cancelada",
  id_negocio: null,
  datos: {
    fecha,
    hora_inicio: hora,
    negocio: "Clínica Patitas",
    sucursal: "Sede Centro",
    direccion: "Calle 23 # 18-45",
    mascota: "Max",
    servicio: "Consulta general",
    motivo: "El veterinario está incapacitado",
  },
  enlace: { id_cita: 77 },
  destinatarios: [{ id_usuario: dueno.id_usuario, rol: "dueno" }],
  excluir,
});

const enviosDe = async (id_usuario) => {
  const [rows] = await pool.query(
    `SELECT e.id_envio, e.canal, e.estado, e.intentos, e.programado_para, e.id_dispositivo, e.error
     FROM notificaciones_envios e JOIN notificaciones n ON n.id_notificacion = e.id_notificacion
     WHERE n.id_usuario = ? ORDER BY e.id_envio`,
    [id_usuario]
  );
  return rows;
};

const notificacionesDe = async (id_usuario) => {
  const [rows] = await pool.query("SELECT * FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [id_usuario]);
  return rows;
};

describe("notificar y despachar", () => {
  it("guarda la notificación con el detalle y envía una push genérica a cada dispositivo después del commit", async () => {
    const dueno = await crearUsuario();
    const [d1, d2] = [await crearDispositivo(dueno), await crearDispositivo(dueno)];

    await conNotificaciones(async (conn, notificarEn) => {
      await notificarEn([cancelada(dueno)]);
      // Nada sale antes del commit.
      expect(pushSender.enviados).toHaveLength(0);
    });

    const [notificacion] = await notificacionesDe(dueno.id_usuario);
    expect(notificacion).toMatchObject({ tipo: "cita_cancelada", titulo: "Cita cancelada", canal: "in_app", estado: "enviada" });
    expect(notificacion.mensaje).toContain("Max");
    expect(notificacion.mensaje).toContain("El veterinario está incapacitado");

    expect(pushSender.enviados.map((m) => m.to).sort()).toEqual([d1.token_expo, d2.token_expo].sort());
    const [push] = pushSender.enviados;
    expect(push.title).toBe("Cita cancelada");
    expect(push.body).toBe(
      "Tu cita con Clínica Patitas del lunes, 12 de octubre a las 9:00 a. m. fue cancelada. Abre PetCat para ver el detalle."
    );
    // Sin datos sensibles en la pantalla de bloqueo ni en el data.
    for (const sensible of ["Max", "incapacitado", "Consulta"]) expect(JSON.stringify(push)).not.toContain(sensible);
    expect(push.data).toEqual({ tipo: "cita_cancelada", id_cita: 77, id_notificacion: notificacion.id_notificacion });
    expect((await enviosDe(dueno.id_usuario)).map((e) => e.estado)).toEqual(["enviado", "enviado"]);
  });

  it("si la transacción falla no queda nada ni se envía nada", async () => {
    const dueno = await crearUsuario();
    await crearDispositivo(dueno);
    const error = await conNotificaciones(async (conn, notificarEn) => {
      await notificarEn([cancelada(dueno)]);
      throw new Error("falló el cambio");
    }).catch((err) => err);

    expect(error.message).toBe("falló el cambio");
    expect(await notificacionesDe(dueno.id_usuario)).toEqual([]);
    expect(pushSender.enviados).toHaveLength(0);
  });

  it("un fallo al enviar no rompe la operación: queda pendiente y el job lo reintenta", async () => {
    const dueno = await crearUsuario();
    await crearDispositivo(dueno);
    pushSender.fallarAlEnviar = true;
    await conNotificaciones((conn, notificarEn) => notificarEn([cancelada(dueno)]));

    const [envio] = await enviosDe(dueno.id_usuario);
    expect(envio).toMatchObject({ estado: "pendiente", intentos: 1, error: "Fallo simulado de Expo" });

    pushSender.fallarAlEnviar = false;
    await procesarEnviosPendientes({ ahora: new Date(Date.now() + 2 * 60_000) });
    expect((await enviosDe(dueno.id_usuario))[0]).toMatchObject({ estado: "enviado", intentos: 2 });
    expect(pushSender.enviados).toHaveLength(1);
  });

  it("DeviceNotRegistered desactiva el dispositivo y el envío queda omitido", async () => {
    const dueno = await crearUsuario();
    const dispositivo = await crearDispositivo(dueno);
    pushSender.noRegistrados.add(dispositivo.token_expo);
    await conNotificaciones((conn, notificarEn) => notificarEn([cancelada(dueno)]));

    expect((await enviosDe(dueno.id_usuario))[0].estado).toBe("omitido");
    const [[{ activo, ultimo_error }]] = await pool.query("SELECT activo, ultimo_error FROM dispositivos WHERE id_dispositivo = ?", [
      dispositivo.id_dispositivo,
    ]);
    expect({ activo: Boolean(activo), ultimo_error }).toEqual({ activo: false, ultimo_error: "DeviceNotRegistered" });
  });

  it("el recibo con DeviceNotRegistered también desactiva el dispositivo", async () => {
    const dueno = await crearUsuario();
    const dispositivo = await crearDispositivo(dueno);
    await conNotificaciones((conn, notificarEn) => notificarEn([cancelada(dueno)]));
    const [[{ ticket_expo }]] = await pool.query(
      "SELECT ticket_expo FROM notificaciones_envios WHERE id_dispositivo = ?",
      [dispositivo.id_dispositivo]
    );
    pushSender.recibosConError.set(ticket_expo, "DeviceNotRegistered");

    await revisarRecibos({ ahora: new Date(Date.now() + 16 * 60_000) });
    expect((await enviosDe(dueno.id_usuario))[0]).toMatchObject({ estado: "fallido", error: "DeviceNotRegistered" });
    const [[{ activo }]] = await pool.query("SELECT activo FROM dispositivos WHERE id_dispositivo = ?", [dispositivo.id_dispositivo]);
    expect(Boolean(activo)).toBe(false);
  });

  it("no se notifica a quien hizo la acción; el propietario que también es empleado recibe una sola", async () => {
    const actor = await crearUsuario();
    const propietario = await crearUsuario();
    await conNotificaciones((conn, notificarEn) =>
      notificarEn([
        {
          tipo: "plan_limite_80",
          id_negocio: null,
          datos: { usadas: 24, maximo: 30, mes: "2026-10", plan: "Gratuito" },
          destinatarios: [
            { id_usuario: actor.id_usuario, rol: "personal" },
            { id_usuario: propietario.id_usuario, rol: "personal" },
            { id_usuario: propietario.id_usuario, rol: "propietario" },
          ],
          excluir: actor.id_usuario,
        },
      ])
    );
    expect(await notificacionesDe(actor.id_usuario)).toEqual([]);
    expect(await notificacionesDe(propietario.id_usuario)).toHaveLength(1);
  });
});

describe("correo para usuarios sin dispositivos", () => {
  it("el dueño sin app recibe el correo con el enlace para darse de baja", async () => {
    const dueno = await crearUsuario({ nombre: "Laura" });
    await conNotificaciones((conn, notificarEn) => notificarEn([cancelada(dueno)]));

    expect(outbox).toHaveLength(1);
    const [correo] = outbox;
    expect(correo).toMatchObject({ to: dueno.email, subject: "Tu cita en Clínica Patitas fue cancelada" });
    expect(correo.text).toContain("Hola Laura,");
    expect(correo.text).toContain("Dónde: Clínica Patitas — Sede Centro, Calle 23 # 18-45.");
    // El motivo y la mascota no van en el correo.
    expect(correo.text).not.toContain("incapacitado");
    expect(correo.text).not.toContain("Max");
    expect(correo.text).toMatch(/Dejar de recibir estos correos: http:\/\/localhost:\d+\/api\/v1\/correo\/baja\?token=/);
    expect(correo.headers).toEqual({
      "List-Unsubscribe": expect.stringMatching(/^<http.+\/correo\/baja\?token=.+>$/),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect((await enviosDe(dueno.id_usuario)).map((e) => [e.canal, e.estado])).toEqual([["email", "enviado"]]);
  });

  it("sin correo si desactivó notif_email; con dispositivos no hay correo aunque apague las push", async () => {
    const sinCorreos = await crearUsuario({ notif_email: false });
    const conApp = await crearUsuario({ notif_push: false });
    await crearDispositivo(conApp);
    await conNotificaciones((conn, notificarEn) => notificarEn([cancelada(sinCorreos), cancelada(conApp)]));

    expect(outbox).toHaveLength(0);
    expect(pushSender.enviados).toHaveLength(0);
    expect(await enviosDe(sinCorreos.id_usuario)).toEqual([]);
    expect(await enviosDe(conApp.id_usuario)).toEqual([]);
    expect(await notificacionesDe(conApp.id_usuario)).toHaveLength(1); // la notificación en la app sí
  });

  it("cita_nueva: correo al propietario sin dispositivo, no al resto del personal", async () => {
    const propietario = await crearUsuario();
    const recepcion = await crearUsuario();
    await conNotificaciones((conn, notificarEn) =>
      notificarEn([
        {
          tipo: "cita_nueva",
          datos: { fecha: "2026-10-12", hora_inicio: "15:00:00", sucursal: "Sede Centro", cliente: "Laura Gómez", mascota: "Max", servicio: "Baño" },
          enlace: { id_cita: 5, id_negocio: 1 },
          destinatarios: [
            { id_usuario: propietario.id_usuario, rol: "propietario" },
            { id_usuario: recepcion.id_usuario, rol: "personal" },
          ],
        },
      ])
    );
    expect(outbox.map((c) => c.to)).toEqual([propietario.email]);
    expect(outbox[0].subject).toBe("Tienes una cita nueva por confirmar en PetCat");
    expect(outbox[0].text).not.toContain("Laura");
  });
});

describe("horario de silencio", () => {
  beforeEach(() => configurarSilencio("21:00", "07:00"));

  // Las pruebas pasan `ahora` explícito (hora de Bogotá).
  const a = (dia, hora, minuto = 0) => new Date(2026, 9, dia, hora, minuto, 0);

  const notificarA = async (ahora, evento) => {
    const creadas = await withTransaction((conn) => notificar([evento], conn, { ahora }));
    await despachar(creadas, { ahora });
  };

  it("a las 22:00 un aviso no urgente queda para las 07:00 y el job lo envía entonces", async () => {
    const dueno = await crearUsuario();
    await crearDispositivo(dueno);
    await notificarA(a(12, 22), cancelada(dueno, { fecha: "2026-10-20" }));

    const [envio] = await enviosDe(dueno.id_usuario);
    expect(envio).toMatchObject({ estado: "pendiente", intentos: 0, programado_para: "2026-10-13 07:00:00" });
    expect(pushSender.enviados).toHaveLength(0);

    await procesarEnviosPendientes({ ahora: a(13, 6, 59) });
    expect(pushSender.enviados).toHaveLength(0);
    await procesarEnviosPendientes({ ahora: a(13, 7) });
    expect(pushSender.enviados).toHaveLength(1);
    expect(pushSender.enviados[0].priority).toBe("default");
  });

  it("urgente: la cancelación de una cita de antes de las 10:00 del día siguiente sale de inmediato y con prioridad alta", async () => {
    const dueno = await crearUsuario();
    await crearDispositivo(dueno);
    await notificarA(a(12, 22), cancelada(dueno, { fecha: "2026-10-13", hora: "08:30:00" }));
    expect(pushSender.enviados).toHaveLength(1);
    expect(pushSender.enviados[0].priority).toBe("high");

    // A las 11:00 ya no es urgente (07:00 + 3 h).
    const otro = await crearUsuario();
    await crearDispositivo(otro);
    await notificarA(a(12, 22), cancelada(otro, { fecha: "2026-10-13", hora: "11:00:00" }));
    expect((await enviosDe(otro.id_usuario))[0].programado_para).toBe("2026-10-13 07:00:00");
  });

  it("los correos también esperan; la notificación en la app se guarda al instante", async () => {
    const dueno = await crearUsuario();
    await notificarA(a(12, 23, 30), cancelada(dueno, { fecha: "2026-10-25" }));
    expect(outbox).toHaveLength(0);
    expect(await notificacionesDe(dueno.id_usuario)).toHaveLength(1);
    expect((await enviosDe(dueno.id_usuario))[0]).toMatchObject({ canal: "email", programado_para: "2026-10-13 07:00:00" });
  });

  it("cálculo: cruza la medianoche, inicio = fin es sin silencio y un valor inválido usa 21:00–07:00", () => {
    const s = silencioDe({ inicio: "21:00", fin: "07:00" });
    expect([a(12, 20, 59), a(12, 21), a(13, 3), a(13, 6, 59), a(13, 7)].map((d) => enSilencio(d, s))).toEqual([false, true, true, true, false]);
    expect(aDatetimeSQL(finDelSilencio(a(12, 22), s))).toBe("2026-10-13 07:00:00");
    expect(aDatetimeSQL(finDelSilencio(a(13, 3), s))).toBe("2026-10-13 07:00:00");
    expect(enSilencio(a(12, 23), silencioDe({ inicio: "07:00", fin: "07:00" }))).toBe(false);
    expect(silencioDe({ inicio: "25:00", fin: "x" })).toEqual({ inicio: 21 * 60, fin: 7 * 60 });
  });
});

describe("GET|POST /correo/baja", () => {
  it("la página pide confirmar; el POST apaga notif_email sin iniciar sesión", async () => {
    const usuario = await crearUsuario();
    const token = tokenBaja(usuario.id_usuario);

    const pagina = await request(app).get(`/api/v1/correo/baja?token=${encodeURIComponent(token)}`);
    expect(pagina.status).toBe(200);
    expect(pagina.type).toBe("text/html");
    expect(pagina.text).toContain("Dejar de recibir correos");
    expect(pagina.text).toContain('<form method="post"');

    const baja = await request(app).post(`/api/v1/correo/baja?token=${encodeURIComponent(token)}`).type("form").send("List-Unsubscribe=One-Click");
    expect(baja.status).toBe(200);
    expect(baja.text).toContain("Ya no recibirás correos");
    const [[{ notif_email }]] = await pool.query("SELECT notif_email FROM usuarios WHERE id_usuario = ?", [usuario.id_usuario]);
    expect(Boolean(notif_email)).toBe(false);
  });

  it("un token inválido o un access token no sirven (400)", async () => {
    const usuario = await crearUsuario();
    for (const token of ["abc", await tokenDe(usuario)]) {
      const res = await request(app).post(`/api/v1/correo/baja?token=${encodeURIComponent(token)}`);
      expect(res.status).toBe(400);
      expect(res.text).toContain("Enlace no válido");
    }
    const [[{ notif_email }]] = await pool.query("SELECT notif_email FROM usuarios WHERE id_usuario = ?", [usuario.id_usuario]);
    expect(Boolean(notif_email)).toBe(true);
  });
});
