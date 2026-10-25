import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { io as cliente } from "socket.io-client";
import app from "../../src/app.js";
import { pool } from "../../src/config/db.js";
import { cerrarSocket, iniciarSocket } from "../../src/realtime/socket.js";
import { conNotificaciones } from "../../src/modules/notificaciones/notificacion.service.js";
import { setToken } from "../../src/modules/usuarios/usuario.repository.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { api } from "../helpers/api.js";
import { PASSWORD, crearUsuario, tokenDe } from "../helpers/factories.js";

let server;
let url;
const abiertos = [];

beforeAll(async () => {
  server = http.createServer(app);
  iniciarSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  for (const s of abiertos) s.disconnect();
  await cerrarSocket();
  await new Promise((resolve) => server.close(resolve));
});

/** Conecta con el access token; resuelve con el socket o rechaza con el error del handshake. */
const conectar = (token) =>
  new Promise((resolve, reject) => {
    const socket = cliente(url, { path: "/socket.io", auth: { token }, transports: ["websocket"], reconnection: false });
    abiertos.push(socket);
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });

/** Próximo evento del socket (o null si no llega en `ms`). */
const siguiente = (socket, evento, ms = 1500) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(evento, (datos) => {
      clearTimeout(timer);
      resolve(datos ?? true);
    });
  });

const avisoPara = (usuario) => ({
  tipo: "plan_limite_80",
  datos: { usadas: 24, maximo: 30, mes: "2026-10", plan: "Gratuito" },
  enlace: { id_negocio: 3 },
  destinatarios: [{ id_usuario: usuario.id_usuario, rol: "propietario" }],
});

describe("Socket.IO: autenticación", () => {
  it("rechaza sin token, con un token inválido y con la sesión cerrada", async () => {
    await expect(conectar(undefined)).rejects.toThrow("Token requerido");
    await expect(conectar("abc")).rejects.toThrow("Token inválido");

    const token = await tokenDe(await crearUsuario());
    await api(token).post("/auth/logout");
    await expect(conectar(token)).rejects.toThrow("Sesión inválida o expirada");
  });

  it("rechaza a un usuario desactivado", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [usuario.id_usuario]);
    await expect(conectar(token)).rejects.toThrow("La cuenta está desactivada");
  });
});

describe("Socket.IO: notificaciones en tiempo real", () => {
  it("cada sesión del usuario recibe la notificación después del commit; otro usuario no", async () => {
    const usuario = await crearUsuario();
    const [app1, panel] = [await conectar(await tokenDe(usuario)), await conectar(await tokenDe(usuario))];
    const otro = await conectar(await tokenDe(await crearUsuario()));

    const esperadas = [siguiente(app1, "notificacion"), siguiente(panel, "notificacion"), siguiente(otro, "notificacion", 500)];
    await conNotificaciones((conn, notificar) => notificar([avisoPara(usuario)]));
    const [a, b, c] = await Promise.all(esperadas);

    expect(a).toMatchObject({
      tipo: "plan_limite_80",
      titulo: "Te quedan pocas citas este mes",
      datos: { tipo: "plan_limite_80", id_negocio: 3 },
      leida: false,
    });
    expect(b.id_notificacion).toBe(a.id_notificacion);
    expect(c).toBeNull();
  });

  it("si la transacción falla no se emite nada", async () => {
    const usuario = await crearUsuario();
    const socket = await conectar(await tokenDe(usuario));
    const esperada = siguiente(socket, "notificacion", 500);
    await conNotificaciones(async (conn, notificar) => {
      await notificar([avisoPara(usuario)]);
      throw new Error("falló");
    }).catch(() => {});
    expect(await esperada).toBeNull();
  });
});

describe("Socket.IO: desconexión al cerrar sesiones", () => {
  it("logout desconecta solo los sockets de esa sesión", async () => {
    const usuario = await crearUsuario();
    const [tokenA, tokenB] = [await tokenDe(usuario), await tokenDe(usuario)];
    const [a, b] = [await conectar(tokenA), await conectar(tokenB)];
    const desconexiones = [siguiente(a, "disconnect"), siguiente(b, "disconnect", 500)];

    await api(tokenA).post("/auth/logout");
    const [da, db] = await Promise.all(desconexiones);
    expect(da).toBe("io server disconnect");
    expect(db).toBeNull();
    expect(b.connected).toBe(true);
  });

  it("change-password desconecta las demás sesiones y deja la actual", async () => {
    const usuario = await crearUsuario();
    const [actual, otra] = [await tokenDe(usuario), await tokenDe(usuario)];
    const [sActual, sOtra] = [await conectar(actual), await conectar(otra)];
    const desconexion = siguiente(sOtra, "disconnect");

    const res = await api(actual).post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: "OtraClave123" });
    expect(res.status).toBe(200);
    expect(await desconexion).toBe("io server disconnect");
    expect(sActual.connected).toBe(true);
  });

  it("reset-password desconecta todas", async () => {
    const usuario = await crearUsuario();
    const sockets = [await conectar(await tokenDe(usuario)), await conectar(await tokenDe(usuario))];
    const desconexiones = sockets.map((s) => siguiente(s, "disconnect"));
    const token = randomBytes(32).toString("hex");
    await setToken(usuario.id_usuario, "recuperacion", { token_hash: hashToken(token), minutos: 60 });

    expect((await api().post("/auth/reset-password").send({ token, password: "NuevaClave123" })).status).toBe(200);
    expect(await Promise.all(desconexiones)).toEqual(["io server disconnect", "io server disconnect"]);
  });
});

describe("GET|PATCH /notificaciones", () => {
  const crearAvisos = async (usuario, n) => {
    for (let i = 0; i < n; i++) await conNotificaciones((conn, notificar) => notificar([avisoPara(usuario)]));
  };

  it("lista las propias con no_leidas; marcar una la devuelve leída y avisa a las demás sesiones", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await crearAvisos(usuario, 3);
    await crearAvisos(await crearUsuario(), 1);

    const lista = await api(token).get("/notificaciones?limit=2");
    expect(lista.status).toBe(200);
    expect(lista.body.data).toHaveLength(2);
    expect(lista.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, hasNext: true, no_leidas: 3 });
    expect(lista.body.data[0]).toMatchObject({ tipo: "plan_limite_80", leida: false, leida_en: null, datos: { id_negocio: 3 } });

    const otraSesion = await conectar(await tokenDe(usuario));
    const aviso = siguiente(otraSesion, "notificaciones_leidas");
    const id = lista.body.data[0].id_notificacion;
    const leida = await api(token).patch(`/notificaciones/${id}/leida`);
    expect(leida.status).toBe(200);
    expect(leida.body.data).toMatchObject({ id_notificacion: id, leida: true, leida_en: expect.any(String) });
    expect(await aviso).toEqual({ no_leidas: 2, por_destino: { dueno: 0, negocio: 2 } });

    // Marcar otra vez devuelve lo mismo.
    expect((await api(token).patch(`/notificaciones/${id}/leida`)).status).toBe(200);
    expect((await api(token).get("/notificaciones?leidas=true")).body.meta.total).toBe(1);
    expect((await api(token).get("/notificaciones?leidas=false")).body.meta.total).toBe(2);
    expect((await api(token).get("/notificaciones/no-leidas")).body.data).toEqual({ total: 2, por_destino: { dueno: 0, negocio: 2 } });
  });

  it("destino separa las de la app del dueño de las del panel: lista, contador y leer-todas", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await crearAvisos(usuario, 2);
    // El mismo usuario recibe un aviso como dueño de una mascota.
    await conNotificaciones((conn, notificar) =>
      notificar([
        {
          tipo: "vacuna_proxima",
          datos: { mascota: "Max", vacuna: "Rabia", fecha_proxima: "2026-11-01" },
          enlace: { id_mascota: 1, id_vacuna: 1 },
          destinatarios: [{ id_usuario: usuario.id_usuario, rol: "dueno" }],
        },
      ])
    );

    const todas = await api(token).get("/notificaciones");
    expect(todas.body.meta).toMatchObject({ total: 3, no_leidas: 3, no_leidas_por_destino: { dueno: 1, negocio: 2 } });
    const panel = await api(token).get("/notificaciones?destino=negocio");
    expect(panel.body.data.map((n) => n.destino)).toEqual(["negocio", "negocio"]);
    expect(panel.body.meta).toMatchObject({ total: 2, no_leidas: 2 });
    const app = await api(token).get("/notificaciones?destino=dueno");
    expect(app.body.data).toMatchObject([{ tipo: "vacuna_proxima", destino: "dueno" }]);
    expect((await api(token).get("/notificaciones/no-leidas?destino=negocio")).body.data).toEqual({
      total: 2,
      por_destino: { dueno: 1, negocio: 2 },
    });

    // Marcar todas desde el panel no toca las de la app.
    const otraSesion = await conectar(await tokenDe(usuario));
    const aviso = siguiente(otraSesion, "notificaciones_leidas");
    expect((await api(token).post("/notificaciones/leer-todas?destino=negocio")).body.data).toEqual({ actualizadas: 2 });
    expect(await aviso).toEqual({ no_leidas: 1, por_destino: { dueno: 1, negocio: 0 } });
    expect((await api(token).get("/notificaciones/no-leidas?destino=dueno")).body.data.total).toBe(1);

    expect((await api(token).get("/notificaciones?destino=panel")).status).toBe(422);
    expect((await api(token).post("/notificaciones/leer-todas?destino=x")).status).toBe(422);
  });

  it("el socket también trae el destino; un propietario que además es dueño recibe la del negocio", async () => {
    const usuario = await crearUsuario();
    const socket = await conectar(await tokenDe(usuario));
    const esperada = siguiente(socket, "notificacion");
    await conNotificaciones((conn, notificar) =>
      notificar([
        {
          ...avisoPara(usuario),
          destinatarios: [
            { id_usuario: usuario.id_usuario, rol: "dueno" },
            { id_usuario: usuario.id_usuario, rol: "propietario" },
          ],
        },
      ])
    );
    expect(await esperada).toMatchObject({ tipo: "plan_limite_80", destino: "negocio" });
  });

  it("leer-todas marca las no leídas; una notificación ajena da 404; sin token 401", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await crearAvisos(usuario, 2);
    const todas = await api(token).post("/notificaciones/leer-todas");
    expect(todas.body.data).toEqual({ actualizadas: 2 });
    expect((await api(token).get("/notificaciones/no-leidas")).body.data.total).toBe(0);

    const ajeno = await crearUsuario();
    await crearAvisos(ajeno, 1);
    const [[{ id_notificacion }]] = await pool.query("SELECT id_notificacion FROM notificaciones WHERE id_usuario = ?", [ajeno.id_usuario]);
    expect((await api(token).patch(`/notificaciones/${id_notificacion}/leida`)).status).toBe(404);
    expect((await api().get("/notificaciones")).status).toBe(401);
    expect((await api(token).get("/notificaciones?leidas=quizas")).status).toBe(422);
  });
});

describe("Swagger de las notificaciones", () => {
  it("el enum de tipos es el catálogo completo", async () => {
    const { TIPOS_NOTIFICACION } = await import("../../src/modules/notificaciones/notificacion.tipos.js");
    const { default: swaggerSpec } = await import("../../src/docs/swagger.js");
    expect([...swaggerSpec.components.schemas.Notificacion.properties.tipo.enum].sort()).toEqual([...TIPOS_NOTIFICACION].sort());
  });
});
