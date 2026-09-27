import { describe, expect, it, vi } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe, unique } from "../helpers/factories.js";

// En este archivo el envío de correo siempre falla, como un SMTP que no responde.
vi.mock("../../src/shared/utils/mailer.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendMail: vi.fn(async () => {
    throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
  }),
}));

describe("auth con el correo caído", () => {
  it("el registro crea la cuenta igual (el correo se reenvía después)", async () => {
    const res = await api()
      .post("/auth/register")
      .send({ nombre: "Ana", apellido: "Ruiz", email: `caido_${unique()}@petcat.test`, password: "Clave1234", acepta_politica_datos: true });
    expect(res.status).toBe(201);
  });

  it("forgot-password responde lo mismo que siempre", async () => {
    const usuario = await crearUsuario();
    const res = await api().post("/auth/forgot-password").send({ email: usuario.email });
    expect(res.status).toBe(200);
  });

  it("resend-verification responde 503 y no guarda el token", async () => {
    const usuario = await crearUsuario();
    const res = await api(await tokenDe(usuario)).post("/auth/resend-verification");

    expect(res.status).toBe(503);
    expect(res.body.message).toBe("No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos");
    const [[row]] = await pool.query("SELECT token_verificacion FROM usuarios WHERE id_usuario = ?", [usuario.id_usuario]);
    expect(row.token_verificacion).toBeNull();
  });
});
