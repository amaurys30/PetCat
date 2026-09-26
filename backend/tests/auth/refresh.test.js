import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { pool } from "../../src/config/db.js";
import { generateToken } from "../../src/shared/utils/jwt.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { api } from "../helpers/api.js";
import { crearUsuario, PASSWORD } from "../helpers/factories.js";

const iniciarSesion = async (usuario) => {
  const res = await api().post("/auth/login").send({ email: usuario.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data;
};

const renovar = (refresh_token) => api().post("/auth/refresh-token").send({ refresh_token });

const sesionDe = async (refresh_token) => {
  const [[row]] = await pool.query(
    "SELECT id_sesion, activa, UNIX_TIMESTAMP(expira_en) AS expira_unix FROM sesiones WHERE refresh_token = ?",
    [hashToken(refresh_token)]
  );
  return row;
};

describe("POST /auth/refresh-token", () => {
  it("devuelve tokens nuevos en la misma sesión y el access token nuevo funciona", async () => {
    const usuario = await crearUsuario();
    const inicial = await iniciarSesion(usuario);
    const { id_sesion } = await sesionDe(inicial.refresh_token);

    const res = await renovar(inicial.refresh_token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Sesión renovada" });
    const { access_token, refresh_token, usuario: perfil } = res.body.data;
    expect(access_token).not.toBe(inicial.access_token);
    expect(refresh_token).not.toBe(inicial.refresh_token);
    expect(perfil).toMatchObject({ id_usuario: usuario.id_usuario, email: usuario.email });
    expect(perfil).not.toHaveProperty("password_hash");

    const sesion = await sesionDe(refresh_token);
    expect(sesion).toMatchObject({ id_sesion, activa: 1 });
    expect((await api(access_token).get("/auth/me")).status).toBe(200);
  });

  it("el refresh token y el access token anteriores dejan de servir", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    expect((await renovar(inicial.refresh_token)).status).toBe(200);

    const otraVez = await renovar(inicial.refresh_token);
    expect(otraVez.status).toBe(401);
    expect(otraVez.body).toEqual({ success: false, message: "Refresh token inválido o expirado" });
    expect((await api(inicial.access_token).get("/auth/me")).status).toBe(401);
  });

  it("extiende el vencimiento de la sesión al del refresh token nuevo", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    const { id_sesion } = await sesionDe(inicial.refresh_token);
    await pool.query("UPDATE sesiones SET expira_en = NOW() + INTERVAL 1 HOUR WHERE id_sesion = ?", [id_sesion]);

    const res = await renovar(inicial.refresh_token);

    const { exp } = jwt.decode(res.body.data.refresh_token);
    const sesion = await sesionDe(res.body.data.refresh_token);
    expect(sesion.expira_unix).toBe(exp);
    expect(exp - Date.now() / 1000).toBeGreaterThan(24 * 3600);
  });

  it("dos renovaciones simultáneas con el mismo token: solo una funciona", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    const respuestas = await Promise.all([renovar(inicial.refresh_token), renovar(inicial.refresh_token)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("sesión cerrada con logout -> 401", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    await api(inicial.access_token).post("/auth/logout");
    expect((await renovar(inicial.refresh_token)).status).toBe(401);
  });

  it("sesión vencida en la base -> 401", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    const { id_sesion } = await sesionDe(inicial.refresh_token);
    await pool.query("UPDATE sesiones SET expira_en = NOW() - INTERVAL 1 MINUTE WHERE id_sesion = ?", [id_sesion]);
    expect((await renovar(inicial.refresh_token)).status).toBe(401);
  });

  it("token mal formado, firmado con otro secreto o un access token -> 401", async () => {
    const inicial = await iniciarSesion(await crearUsuario());
    for (const token of ["no-es-un-jwt", inicial.access_token, generateToken({ id_usuario: 1 })]) {
      const res = await renovar(token);
      expect(res.status).toBe(401);
    }
  });

  it("cuenta desactivada -> 403", async () => {
    const usuario = await crearUsuario();
    const inicial = await iniciarSesion(usuario);
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [usuario.id_usuario]);
    const res = await renovar(inicial.refresh_token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("La cuenta está desactivada");
  });

  it("sin refresh_token o con campos extra -> 422", async () => {
    expect((await api().post("/auth/refresh-token").send({})).status).toBe(422);
    const res = await api().post("/auth/refresh-token").send({ refresh_token: "x", id_usuario: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_usuario: "Campo no permitido" });
  });
});
