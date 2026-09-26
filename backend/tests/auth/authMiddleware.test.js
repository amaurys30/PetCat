import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { pool } from "../../src/config/db.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { createSessionForUser } from "../../src/modules/sessions/session.service.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe } from "../helpers/factories.js";

// POST /auth/logout es la ruta protegida más simple: todo lo que se prueba aquí ocurre antes del controlador.
const protegida = (token) => api(token).post("/auth/logout");

const sesionesDe = async (id_usuario) => {
  const [rows] = await pool.query("SELECT * FROM sesiones WHERE id_usuario = ?", [id_usuario]);
  return rows;
};

describe("createSessionForUser", () => {
  it("guarda el hash SHA-256 de los tokens, no los tokens", async () => {
    const usuario = await crearUsuario();
    const sesion = await createSessionForUser(usuario, { ip: "10.0.0.1", userAgent: "agente", dispositivo: "web" });

    const [fila] = await sesionesDe(usuario.id_usuario);
    expect(fila.token).toBe(hashToken(sesion.access_token));
    expect(fila.refresh_token).toBe(hashToken(sesion.refresh_token));
    expect(fila.token).toMatch(/^[0-9a-f]{64}$/);
    expect(fila).toMatchObject({ ip_address: "10.0.0.1", user_agent: "agente", dispositivo: "web", activa: 1 });
  });

  it("la sesión vence cuando vence el refresh token", async () => {
    const usuario = await crearUsuario();
    const { refresh_token } = await createSessionForUser(usuario);
    const [[fila]] = await pool.query(
      "SELECT UNIX_TIMESTAMP(expira_en) AS expira FROM sesiones WHERE id_usuario = ?",
      [usuario.id_usuario]
    );
    expect(Number(fila.expira)).toBe(jwt.decode(refresh_token).exp);
  });

  it("dos sesiones seguidas del mismo usuario tienen tokens distintos", async () => {
    const usuario = await crearUsuario();
    const a = await createSessionForUser(usuario);
    const b = await createSessionForUser(usuario);
    expect(a.access_token).not.toBe(b.access_token);
    expect(a.refresh_token).not.toBe(b.refresh_token);
  });

  it("devuelve el usuario sin campos sensibles", async () => {
    const usuario = await crearUsuario();
    const { usuario: publico } = await createSessionForUser(usuario);
    expect(publico).toMatchObject({ id_usuario: usuario.id_usuario, email: usuario.email, email_verificado: false });
    for (const campo of ["password_hash", "token_verificacion", "token_recuperacion", "intentos_login", "bloqueado_hasta"]) {
      expect(publico).not.toHaveProperty(campo);
    }
  });
});

describe("authMiddleware", () => {
  it("sin cabecera Authorization -> 401 Token requerido", async () => {
    const res = await protegida();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: "Token requerido" });
  });

  it("cabecera mal formada -> 401 (no 500)", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    for (const header of [token, `Token ${token}`, "Bearer", "Bearer ", `Bearer ${token} extra`]) {
      const res = await api().post("/auth/logout").set("Authorization", header);
      expect(res.status, header).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it("acepta el esquema Bearer sin distinguir mayúsculas", async () => {
    const token = await tokenDe(await crearUsuario());
    const res = await api().post("/auth/logout").set("Authorization", `bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("firma inválida -> 401 Token inválido", async () => {
    const token = jwt.sign({ id_usuario: 1 }, "otro-secreto-de-al-menos-32-caracteres!!");
    const res = await protegida(token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token inválido");
  });

  it("algoritmo none -> 401", async () => {
    const token = jwt.sign({ id_usuario: 1 }, null, { algorithm: "none" });
    const res = await protegida(token);
    expect(res.status).toBe(401);
  });

  it("token expirado -> 401 Token expirado", async () => {
    const token = jwt.sign({ id_usuario: 1 }, env.JWT_SECRET, { expiresIn: -10 });
    const res = await protegida(token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token expirado");
  });

  it("token bien firmado pero sin sesión -> 401", async () => {
    const usuario = await crearUsuario();
    const token = jwt.sign({ id_usuario: usuario.id_usuario }, env.JWT_SECRET, { expiresIn: "1h" });
    const res = await protegida(token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Sesión inválida o expirada");
  });

  it("sesión vencida (expira_en en el pasado) -> 401", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await pool.query("UPDATE sesiones SET expira_en = NOW() - INTERVAL 1 MINUTE WHERE token = ?", [hashToken(token)]);
    const res = await protegida(token);
    expect(res.status).toBe(401);
  });

  it("usuario desactivado -> 403", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [usuario.id_usuario]);
    const res = await protegida(token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("La cuenta está desactivada");
  });
});

describe("POST /auth/logout", () => {
  it("cierra solo la sesión del token usado", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    const otro = await tokenDe(usuario);

    const res = await protegida(token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Sesión cerrada" });

    expect((await protegida(token)).status).toBe(401);
    expect((await protegida(otro)).status).toBe(200);
  });
});
