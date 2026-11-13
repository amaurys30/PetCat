import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";
import { apiGet } from "./client";
import { login } from "./auth";
import { ApiError } from "./errors";
import { leerRefresh } from "./refreshStorage";
import {
  __reiniciarSesionParaPruebas,
  getAccessToken,
  iniciarSesionLocal,
  pedirSesionAPestanas,
  renovarSesion,
  suscribirSesion,
  type EventoSesion,
} from "./sesion";

/** Otra pestaña del mismo navegador. */
let otraPestana: BroadcastChannel;
const mensajesDeOtra: unknown[] = [];

beforeEach(() => {
  __reiniciarSesionParaPruebas();
  mensajesDeOtra.length = 0;
  otraPestana = new BroadcastChannel("petcat-sesion");
  otraPestana.onmessage = (e) => mensajesDeOtra.push(e.data);
});

afterEach(() => {
  otraPestana.close();
  vi.unstubAllGlobals();
});

/** Endpoint protegido que solo acepta `token`. */
const protegido = (token: string) =>
  http.get(`${API}/privado`, ({ request }) =>
    request.headers.get("Authorization") === `Bearer ${token}`
      ? ok({ ok: true })
      : fallo(401, "Token expirado"),
  );

describe("renovación del access token", () => {
  it("dos 401 simultáneos hacen una sola renovación y repiten las dos peticiones", async () => {
    iniciarSesionLocal("viejo", "refresh-1", true);
    let renovaciones = 0;
    servidor.use(
      protegido("nuevo"),
      http.post(`${API}/auth/refresh-token`, async ({ request }) => {
        renovaciones += 1;
        expect(await request.json()).toEqual({ refresh_token: "refresh-1" });
        return ok({ access_token: "nuevo", refresh_token: "refresh-2" });
      }),
    );

    const [a, b] = await Promise.all([apiGet("/privado"), apiGet("/privado")]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(renovaciones).toBe(1);
    expect(getAccessToken()).toBe("nuevo");
    expect(leerRefresh()).toEqual({ token: "refresh-2", recordar: true });
  });

  it("avisa a las otras pestañas con los tokens nuevos", async () => {
    iniciarSesionLocal("viejo", "refresh-1", false);
    servidor.use(
      http.post(`${API}/auth/refresh-token`, () => ok({ access_token: "nuevo", refresh_token: "refresh-2" })),
    );

    await renovarSesion();

    await vi.waitFor(() =>
      expect(mensajesDeOtra).toContainEqual({
        tipo: "tokens",
        access: "nuevo",
        refresh: "refresh-2",
        recordar: false,
      }),
    );
    expect(leerRefresh()).toEqual({ token: "refresh-2", recordar: false });
  });

  it("si otra pestaña renovó mientras esperaba el candado, usa sus tokens y no renueva otra vez", async () => {
    iniciarSesionLocal("viejo", "refresh-1", true);
    let soltar!: () => void;
    const candadoLibre = new Promise<void>((r) => (soltar = r));
    vi.stubGlobal("navigator", {
      ...navigator,
      locks: { request: async (_n: string, fn: () => Promise<unknown>) => (await candadoLibre, fn()) },
    });
    const refresco = vi.fn(() => ok({ access_token: "mio", refresh_token: "refresh-x" }));
    servidor.use(http.post(`${API}/auth/refresh-token`, refresco));

    const renovacion = renovarSesion();
    otraPestana.postMessage({ tipo: "tokens", access: "de-la-otra", refresh: "refresh-2", recordar: true });
    await vi.waitFor(() => expect(getAccessToken()).toBe("de-la-otra"));
    soltar();

    await expect(renovacion).resolves.toBe("de-la-otra");
    expect(refresco).not.toHaveBeenCalled();
  });

  it("si la renovación falla con 401 cierra la sesión como vencida", async () => {
    iniciarSesionLocal("viejo", "refresh-1", true);
    const eventos: EventoSesion[] = [];
    suscribirSesion((e) => eventos.push(e));
    servidor.use(
      protegido("nunca"),
      http.post(`${API}/auth/refresh-token`, () => fallo(401, "Sesión inválida o expirada")),
    );

    const error = await apiGet("/privado").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(eventos).toEqual([{ tipo: "cerrada", motivo: "expirada" }]);
    expect(getAccessToken()).toBeNull();
    expect(leerRefresh()).toBeNull();
  });

  it("sin conexión al renovar no cierra la sesión", async () => {
    iniciarSesionLocal("viejo", "refresh-1", true);
    servidor.use(http.post(`${API}/auth/refresh-token`, () => HttpResponse.error()));

    const error = await renovarSesion().catch((e: unknown) => e);

    expect((error as ApiError).sinConexion).toBe(true);
    expect(leerRefresh()).toEqual({ token: "refresh-1", recordar: true });
  });

  it("un 401 del login es credenciales inválidas: no intenta renovar", async () => {
    const refresco = vi.fn(() => ok({}));
    servidor.use(
      http.post(`${API}/auth/login`, () => fallo(401, "Credenciales inválidas")),
      http.post(`${API}/auth/refresh-token`, refresco),
    );

    await expect(login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({
      status: 401,
      message: "Credenciales inválidas",
    });
    expect(refresco).not.toHaveBeenCalled();
  });
});

describe("sesión entre pestañas", () => {
  it("una pestaña nueva sin refresh token propio lo pide a las abiertas", async () => {
    otraPestana.onmessage = (e: MessageEvent<{ tipo: string }>) => {
      if (e.data.tipo === "pedir") {
        otraPestana.postMessage({ tipo: "respuesta", access: "a1", refresh: "r1", recordar: false });
      }
    };

    await expect(pedirSesionAPestanas()).resolves.toBe(true);
    expect(getAccessToken()).toBe("a1");
    expect(leerRefresh()).toEqual({ token: "r1", recordar: false });
  });

  it("al recargar con una pestaña abierta usa sus tokens vigentes y no renueva con el guardado", async () => {
    // Recarga sin "Recordarme": esta pestaña conserva en sessionStorage un token que la otra ya rotó.
    sessionStorage.setItem("petcat.refresh_token", "r-viejo");
    otraPestana.onmessage = (e: MessageEvent<{ tipo: string }>) => {
      if (e.data.tipo === "pedir") {
        otraPestana.postMessage({ tipo: "respuesta", access: "a-vigente", refresh: "r-vigente", recordar: false });
      }
    };
    const refresco = vi.fn(() => fallo(401, "Sesión inválida o expirada"));
    servidor.use(http.post(`${API}/auth/refresh-token`, refresco));

    await expect(renovarSesion()).resolves.toBe("a-vigente");
    expect(refresco).not.toHaveBeenCalled();
    expect(leerRefresh()).toEqual({ token: "r-vigente", recordar: false });
  });

  it("si otra pestaña rotó el token mientras se usaba, reintenta con el nuevo y no borra la sesión", async () => {
    localStorage.setItem("petcat.refresh_token", "r-1");
    const usados: string[] = [];
    servidor.use(
      http.post(`${API}/auth/refresh-token`, async ({ request }) => {
        const { refresh_token } = (await request.json()) as { refresh_token: string };
        usados.push(refresh_token);
        if (refresh_token === "r-1") {
          // La otra pestaña renovó con r-1 primero y dejó r-2 en localStorage.
          localStorage.setItem("petcat.refresh_token", "r-2");
          return fallo(401, "Sesión inválida o expirada");
        }
        return ok({ access_token: "a-3", refresh_token: "r-3" });
      }),
    );

    await expect(renovarSesion()).resolves.toBe("a-3");
    expect(usados).toEqual(["r-1", "r-2"]);
    expect(leerRefresh()).toEqual({ token: "r-3", recordar: true });
  });

  it("un 401 con un token viejo no borra el que otra pestaña acaba de guardar", async () => {
    localStorage.setItem("petcat.refresh_token", "r-1");
    servidor.use(
      http.post(`${API}/auth/refresh-token`, async ({ request }) => {
        const { refresh_token } = (await request.json()) as { refresh_token: string };
        // Cada intento llega tarde: otra pestaña ya rotó el token y dejó uno nuevo.
        localStorage.setItem("petcat.refresh_token", `${refresh_token}-rotado`);
        return fallo(401, "Sesión inválida o expirada");
      }),
    );

    await expect(renovarSesion()).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(leerRefresh()).toEqual({ token: "r-1-rotado-rotado", recordar: true });
  });

  it("sin pestañas abiertas responde false", async () => {
    await expect(pedirSesionAPestanas()).resolves.toBe(false);
  });

  it("el cierre de sesión en otra pestaña borra la de esta", async () => {
    iniciarSesionLocal("a1", "r1", true);
    const eventos: EventoSesion[] = [];
    suscribirSesion((e) => eventos.push(e));

    otraPestana.postMessage({ tipo: "cierre" });

    await vi.waitFor(() => expect(eventos).toEqual([{ tipo: "cerrada", motivo: "otra-pestana" }]));
    expect(getAccessToken()).toBeNull();
    expect(leerRefresh()).toBeNull();
  });
});

describe("errores normalizados", () => {
  it("422 trae los errores por campo y 403 con plan se reconoce como límite del plan", async () => {
    servidor.use(
      http.get(`${API}/invalido`, () =>
        fallo(422, "Datos inválidos", { email: "Correo electrónico inválido" }),
      ),
      http.get(`${API}/plan`, () =>
        fallo(403, "Tu plan Gratuito permite hasta 3 empleados.", { plan: "Límite" }),
      ),
    );

    const invalido = (await apiGet("/invalido").catch((e: unknown) => e)) as ApiError;
    expect(invalido.errors).toEqual({ email: "Correo electrónico inválido" });

    const plan = (await apiGet("/plan").catch((e: unknown) => e)) as ApiError;
    expect(plan.limitePlan).toBe("Límite");
  });
});
