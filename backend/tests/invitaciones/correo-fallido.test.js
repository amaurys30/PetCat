import { describe, expect, it, vi } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearNegocio, tokenDe } from "../helpers/factories.js";

// En este archivo el envío de correo siempre falla, como un SMTP que no responde.
vi.mock("../../src/shared/utils/mailer.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendMail: vi.fn(async () => {
    throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
  }),
}));

describe("envío de invitación con el correo caído", () => {
  it("responde 503 y no deja la invitación creada", async () => {
    const negocio = await crearNegocio();
    const empleado = await crearEmpleado(negocio);
    const res = await api(await tokenDe(negocio.propietario)).post(`/empleados/${empleado.id_empleado}/invitacion`);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      message: "No se pudo enviar el correo de invitación. Intenta de nuevo en unos minutos",
    });
    const [filas] = await pool.query("SELECT 1 FROM invitaciones_empleado WHERE id_empleado = ?", [empleado.id_empleado]);
    expect(filas).toHaveLength(0);
  });
});
