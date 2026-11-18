import * as SecureStore from "expo-secure-store";
import { http, HttpResponse } from "msw";

import { queryClient } from "@/lib/queryClient";
import { useSesion } from "@/store/sesion";

import { API, ok, usuarioDemo } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";

import { api } from "./client";
import { ApiError, MENSAJES } from "./errors";
import { refreshStorage } from "./refreshStorage";
import { guardarSesion } from "./sesion";

// Endpoint protegido de prueba: solo acepta el token vigente.
function protegido(tokenValido: () => string) {
  return http.get(`${API}/privado/:n`, ({ request, params }) =>
    request.headers.get("authorization") === `Bearer ${tokenValido()}`
      ? ok({ n: params.n })
      : HttpResponse.json({ success: false, message: "Token inválido" }, { status: 401 }),
  );
}

let llamadasRefresh = 0;
let refreshEnviados: string[] = [];

function refreshQueRota(siguiente: { access: string; refresh: string }, demoraMs = 0) {
  return http.post(`${API}/auth/refresh-token`, async ({ request }) => {
    llamadasRefresh += 1;
    const cuerpo = (await request.json()) as { refresh_token: string };
    refreshEnviados.push(cuerpo.refresh_token);
    if (demoraMs) await new Promise((r) => setTimeout(r, demoraMs));
    return ok(
      { access_token: siguiente.access, refresh_token: siguiente.refresh, usuario: usuarioDemo },
      "Sesión renovada",
    );
  });
}

beforeEach(async () => {
  llamadasRefresh = 0;
  refreshEnviados = [];
  await refreshStorage.borrar();
  useSesion.setState({ accessToken: null, usuario: null, estado: "desconocida" });
  queryClient.clear();
  await guardarSesion({ access_token: "access-1", refresh_token: "refresh-1", usuario: usuarioDemo });
});

describe("cliente de la API", () => {
  it("agrega el access token a cada petición", async () => {
    server.use(protegido(() => "access-1"));
    const { data } = await api.get("/privado/1");
    expect(data.data).toEqual({ n: "1" });
    expect(llamadasRefresh).toBe(0);
  });

  it("ante un 401 renueva la sesión y reintenta la petición", async () => {
    server.use(
      protegido(() => "access-2"),
      refreshQueRota({ access: "access-2", refresh: "refresh-2" }),
    );

    const { data } = await api.get("/privado/7");

    expect(data.data).toEqual({ n: "7" });
    expect(llamadasRefresh).toBe(1);
    expect(refreshEnviados).toEqual(["refresh-1"]);
    expect(useSesion.getState().accessToken).toBe("access-2");
  });

  it("tres 401 a la vez generan un solo refresh y se reintentan las tres", async () => {
    server.use(
      protegido(() => "access-2"),
      refreshQueRota({ access: "access-2", refresh: "refresh-2" }, 50),
    );

    const respuestas = await Promise.all([
      api.get("/privado/1"),
      api.get("/privado/2"),
      api.get("/privado/3"),
    ]);

    expect(respuestas.map((r) => r.data.data.n)).toEqual(["1", "2", "3"]);
    expect(llamadasRefresh).toBe(1);
  });

  it("guarda el refresh rotado en SecureStore antes de poner el access en memoria", async () => {
    const orden: string[] = [];
    jest.mocked(SecureStore.setItemAsync).mockClear();
    const quitar = useSesion.subscribe((s, previo) => {
      if (s.accessToken !== previo.accessToken) orden.push(`memoria:${s.accessToken}`);
    });
    const setOriginal = jest.mocked(SecureStore.setItemAsync).getMockImplementation()!;
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (clave, valor) => {
      orden.push(`securestore:${valor}`);
      return setOriginal(clave, valor);
    });
    server.use(
      protegido(() => "access-2"),
      refreshQueRota({ access: "access-2", refresh: "refresh-2" }),
    );

    await api.get("/privado/1");
    quitar();
    jest.mocked(SecureStore.setItemAsync).mockImplementation(setOriginal);

    expect(await refreshStorage.leer()).toBe("refresh-2");
    expect(orden).toEqual(["securestore:refresh-2", "memoria:access-2"]);
  });

  it.each([401, 403])(
    "si el refresh responde %i: cierra sesión, borra la caché y rechaza la cola",
    async (status) => {
      queryClient.setQueryData(["mascotas"], [{ id: 1 }]);
      server.use(
        protegido(() => "access-2"),
        http.post(`${API}/auth/refresh-token`, () => {
          llamadasRefresh += 1;
          return HttpResponse.json({ success: false, message: "Sesión inválida" }, { status });
        }),
      );

      const resultados = await Promise.allSettled([api.get("/privado/1"), api.get("/privado/2")]);

      for (const r of resultados) {
        expect(r.status).toBe("rejected");
        const motivo = (r as PromiseRejectedResult).reason as ApiError;
        expect(motivo).toBeInstanceOf(ApiError);
        expect(motivo).toMatchObject({ tipo: "sesion", message: MENSAJES.sesion });
      }
      expect(llamadasRefresh).toBe(1);
      expect(await refreshStorage.leer()).toBeNull();
      expect(useSesion.getState()).toMatchObject({ accessToken: null, usuario: null, estado: "anonima" });
      expect(queryClient.getQueryData(["mascotas"])).toBeUndefined();
    },
  );

  it("si falla la red durante el refresh: no cierra sesión y conserva el refresh", async () => {
    server.use(
      protegido(() => "access-2"),
      http.post(`${API}/auth/refresh-token`, () => HttpResponse.error()),
    );

    await expect(api.get("/privado/1")).rejects.toMatchObject({ tipo: "red", message: MENSAJES.red });
    expect(await refreshStorage.leer()).toBe("refresh-1");
    expect(useSesion.getState()).toMatchObject({ accessToken: "access-1", estado: "autenticada" });
  });

  it("sin refresh guardado, un 401 cierra la sesión", async () => {
    await refreshStorage.borrar();
    server.use(protegido(() => "access-2"));
    await expect(api.get("/privado/1")).rejects.toMatchObject({ tipo: "sesion" });
    expect(useSesion.getState().estado).toBe("anonima");
  });

  it("las peticiones marcadas sinRenovar no intentan renovar", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ success: false, message: "Correo o contraseña incorrectos" }, { status: 401 }),
      ),
      refreshQueRota({ access: "x", refresh: "y" }),
    );

    await expect(api.post("/auth/login", {}, { sinRenovar: true })).rejects.toMatchObject({
      status: 401,
      message: "Correo o contraseña incorrectos",
    });
    expect(llamadasRefresh).toBe(0);
  });

  it("un 401 después del reintento no vuelve a renovar", async () => {
    server.use(
      protegido(() => "nunca"),
      refreshQueRota({ access: "access-2", refresh: "refresh-2" }),
    );
    await expect(api.get("/privado/1")).rejects.toMatchObject({ status: 401, message: "Token inválido" });
    expect(llamadasRefresh).toBe(1);
  });

  it("los demás errores salen como ApiError en español", async () => {
    server.use(
      http.get(`${API}/roto`, () => HttpResponse.json({ message: "stack trace interno" }, { status: 500 })),
    );
    await expect(api.get("/roto")).rejects.toMatchObject({ status: 500, message: MENSAJES.servidor });
  });
});
