import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { api } from "../helpers/api.js";
import { crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

/**
 * Bloqueos por un índice secundario (FOR UPDATE por token o por id_negocio): varias
 * solicitudes simultáneas no deben terminar en deadlock (500).
 */
const RONDAS = 5;

const conToken = async (tipo) => {
  const usuario = await crearUsuario();
  const token = randomBytes(32).toString("hex");
  await pool.query(
    `UPDATE usuarios SET token_${tipo} = ?, token_${tipo}_expira = NOW() + INTERVAL 1 HOUR WHERE id_usuario = ?`,
    [hashToken(token), usuario.id_usuario]
  );
  return token;
};

describe("bloqueos por índice secundario con solicitudes simultáneas", () => {
  it("el mismo enlace de verificación 5 veces a la vez: una 200 y las demás 400", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const token = await conToken("verificacion");
      const respuestas = await Promise.all(
        Array.from({ length: 5 }, () => api().get(`/auth/verify-email/${token}`))
      );
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 400, 400, 400, 400]);
    }
  });

  it("el mismo enlace para restablecer la contraseña 5 veces a la vez: una 200 y las demás 400", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const token = await conToken("recuperacion");
      const respuestas = await Promise.all(
        Array.from({ length: 5 }, () => api().post("/auth/reset-password").send({ token, password: "Nueva1234" }))
      );
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 400, 400, 400, 400]);
    }
  });

  it("negocios nuevos que activan la prueba Pro a la vez: todos 201", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const negocios = [];
      for (let i = 0; i < 4; i++) negocios.push(await crearNegocio());
      const tokens = await Promise.all(negocios.map((n) => tokenDe(n.propietario)));
      const respuestas = await Promise.all(
        negocios.map((n, i) => api(tokens[i]).post(`/negocios/${n.id_negocio}/suscripcion/prueba-pro`))
      );
      expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    }
  });
});
