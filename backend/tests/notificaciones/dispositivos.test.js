import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { deactivateByUsuario } from "../../src/modules/sessions/session.repository.js";
import { api } from "../helpers/api.js";
import { PASSWORD, crearUsuario, tokenDe, unique } from "../helpers/factories.js";

const tokenExpo = () => `ExponentPushToken[${unique()}${unique()}]`;

const registrar = (token, token_expo, extra = {}) =>
  api(token).post("/dispositivos").send({ token_expo, plataforma: "android", ...extra });

const dispositivo = async (token_expo) => {
  const [[fila]] = await pool.query("SELECT id_usuario, id_sesion, activo FROM dispositivos WHERE token_expo = ?", [token_expo]);
  return fila && { ...fila, activo: Boolean(fila.activo) };
};

/** Usuario con dos sesiones (dos teléfonos), cada una con su dispositivo registrado. */
const dosTelefonos = async () => {
  const usuario = await crearUsuario();
  const [tokenA, tokenB] = [await tokenDe(usuario), await tokenDe(usuario)];
  const [expoA, expoB] = [tokenExpo(), tokenExpo()];
  await registrar(tokenA, expoA);
  await registrar(tokenB, expoB);
  return { usuario, tokenA, tokenB, expoA, expoB };
};

describe("POST /dispositivos", () => {
  it("registra el token ligado a la sesión; repetirlo responde 200", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    const expo = tokenExpo();

    const res = await registrar(token, expo, { plataforma: "ios", nombre: "iPhone 13" });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Dispositivo registrado");
    expect(res.body.data).toMatchObject({ token_expo: expo, plataforma: "ios", nombre: "iPhone 13", activo: true });
    const [[{ id_sesion }]] = await pool.query("SELECT MAX(id_sesion) AS id_sesion FROM sesiones WHERE id_usuario = ?", [usuario.id_usuario]);
    expect(await dispositivo(expo)).toEqual({ id_usuario: usuario.id_usuario, id_sesion, activo: true });

    const otraVez = await registrar(token, expo, { plataforma: "ios" });
    expect(otraVez.status).toBe(200);
    expect(otraVez.body.message).toBe("Dispositivo actualizado");
  });

  it("un token que ya era de otra cuenta (mismo teléfono) pasa a la nueva y se reactiva", async () => {
    const expo = tokenExpo();
    const anterior = await crearUsuario();
    await registrar(await tokenDe(anterior), expo);
    await pool.query("UPDATE dispositivos SET activo = FALSE WHERE token_expo = ?", [expo]);

    const nueva = await crearUsuario();
    expect((await registrar(await tokenDe(nueva), expo)).status).toBe(200);
    expect(await dispositivo(expo)).toMatchObject({ id_usuario: nueva.id_usuario, activo: true });
  });

  it("422 con un token que no es de Expo o una plataforma desconocida; 401 sin token", async () => {
    const token = await tokenDe(await crearUsuario());
    const malo = await registrar(token, "abc123");
    expect(malo.status).toBe(422);
    expect(malo.body.errors).toEqual({ token_expo: "Debe ser un token de Expo Push (ExponentPushToken[...])" });
    expect((await registrar(token, tokenExpo(), { plataforma: "windows" })).body.errors).toHaveProperty("plataforma");
    expect((await api().post("/dispositivos").send({ token_expo: tokenExpo(), plataforma: "ios" })).status).toBe(401);
  });
});

describe("DELETE /dispositivos", () => {
  it("desactiva el propio; repetirlo o el de otro usuario da 404", async () => {
    const { tokenA, expoA, expoB } = await dosTelefonos();
    const res = await api(tokenA).delete("/dispositivos").send({ token_expo: expoA });
    expect(res.status).toBe(200);
    expect((await dispositivo(expoA)).activo).toBe(false);
    expect((await api(tokenA).delete("/dispositivos").send({ token_expo: expoA })).status).toBe(404);

    const ajeno = await api(await tokenDe(await crearUsuario())).delete("/dispositivos").send({ token_expo: expoB });
    expect(ajeno.status).toBe(404);
    expect((await dispositivo(expoB)).activo).toBe(true);
  });
});

describe("cerrar sesiones desactiva sus dispositivos", () => {
  it("logout: solo el de esa sesión", async () => {
    const { tokenA, expoA, expoB } = await dosTelefonos();
    expect((await api(tokenA).post("/auth/logout")).status).toBe(200);
    expect((await dispositivo(expoA)).activo).toBe(false);
    expect((await dispositivo(expoB)).activo).toBe(true);
  });

  it("change-password: los de las demás sesiones, no el de la actual", async () => {
    const { tokenA, expoA, expoB } = await dosTelefonos();
    const res = await api(tokenA).post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: "OtraClave123" });
    expect(res.status).toBe(200);
    expect((await dispositivo(expoA)).activo).toBe(true);
    expect((await dispositivo(expoB)).activo).toBe(false);
  });

  it("cerrar todas (reset-password): todos", async () => {
    const { usuario, expoA, expoB } = await dosTelefonos();
    await deactivateByUsuario(usuario.id_usuario);
    expect((await dispositivo(expoA)).activo).toBe(false);
    expect((await dispositivo(expoB)).activo).toBe(false);
  });
});
