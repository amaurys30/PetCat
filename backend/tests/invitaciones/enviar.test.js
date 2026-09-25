import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { outbox, clearOutbox } from "../../src/shared/utils/mailer.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearInvitacion, crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

const tokenDelCorreo = (mail) => /\/invitacion\/([0-9a-f]{64})/.exec(mail.text)?.[1];

const invitacionesDe = async (id_empleado) => {
  const [rows] = await pool.query(
    `SELECT id_invitacion, token, intentos_reenvio, usado, (expiracion > NOW()) AS vigente,
            TIMESTAMPDIFF(MINUTE, NOW(), expiracion) AS minutos
     FROM invitaciones_empleado WHERE id_empleado = ? ORDER BY id_invitacion`,
    [id_empleado]
  );
  return rows;
};

const escenario = async (overridesEmpleado = {}) => {
  const negocio = await crearNegocio(null, { nombre: "Clínica <Patitas>" });
  const empleado = await crearEmpleado(negocio, { rol: "Recepcionista", nombre: "Ana", ...overridesEmpleado });
  return { negocio, empleado, token: await tokenDe(negocio.propietario) };
};

beforeEach(() => clearOutbox());

describe("POST /empleados/:id_empleado/invitacion", () => {
  it("envía el correo con el enlace, guarda solo el hash y no devuelve el token", async () => {
    const { empleado, token } = await escenario();
    const res = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Invitación enviada");
    expect(Object.keys(res.body.data).sort()).toEqual(["email", "envios_restantes_24h", "expiracion", "id_invitacion"]);
    expect(res.body.data).toMatchObject({ email: empleado.email, envios_restantes_24h: 3 });

    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail.to).toBe(empleado.email);
    expect(mail.subject).toContain("Clínica <Patitas>");
    expect(mail.text).toContain("con el rol Recepcionista");
    expect(mail.text).toContain("http://localhost:5173/invitacion/");
    // El HTML escapa los datos del negocio.
    expect(mail.html).toContain("Clínica &lt;Patitas&gt;");

    const tokenReal = tokenDelCorreo(mail);
    expect(JSON.stringify(res.body)).not.toContain(tokenReal);
    const [invitacion] = await invitacionesDe(empleado.id_empleado);
    expect(invitacion.token).toBe(hashToken(tokenReal));
    expect(invitacion).toMatchObject({ vigente: 1, intentos_reenvio: 0 });
    // Vigencia de 72 horas.
    expect(invitacion.minutos).toBeGreaterThan(72 * 60 - 2);
    expect(invitacion.minutos).toBeLessThanOrEqual(72 * 60);
  });

  it("409 si no tiene email, está inactivo, ya tiene cuenta o ya tiene una invitación vigente", async () => {
    const casos = [
      [{ email: null }, "no tiene email"],
      [{ activo: false }, "inactivo"],
      [{ usuario: await crearUsuario() }, "ya tiene una cuenta"],
    ];
    for (const [overrides, mensaje] of casos) {
      const { empleado, token } = await escenario(overrides);
      const res = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);
      expect(res.status, mensaje).toBe(409);
      expect(res.body.message).toContain(mensaje);
    }

    const { empleado, token } = await escenario();
    await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);
    const repetida = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);
    expect(repetida.status).toBe(409);
    expect(repetida.body.message).toContain("usa reenviar");
    expect(outbox).toHaveLength(1);
  });

  it("con la invitación vencida se puede volver a enviar", async () => {
    const { empleado, token } = await escenario();
    await crearInvitacion(empleado, { expiracion: "2020-01-01 00:00:00" });
    expect((await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`)).status).toBe(201);
  });

  it("401 sin token, 403 sin empleados.crear o de otro negocio, 404 inexistente, 422 id inválido", async () => {
    const { negocio, empleado, token } = await escenario();
    const url = `/empleados/${empleado.id_empleado}/invitacion`;
    expect((await api().post(url)).status).toBe(401);

    const vet = await crearUsuario();
    await crearEmpleado(negocio, { usuario: vet });
    expect((await api(await tokenDe(vet)).post(url)).status).toBe(403);
    expect((await api(await tokenDe((await crearNegocio()).propietario)).post(url)).status).toBe(403);

    expect((await api(token).post("/empleados/999999/invitacion")).status).toBe(404);
    expect((await api(token).post("/empleados/abc/invitacion")).status).toBe(422);
    expect(outbox).toHaveLength(0);
  });
});

describe("POST /empleados/:id_empleado/invitacion/reenviar", () => {
  it("invalida la vigente y envía otra; el enlace anterior deja de servir", async () => {
    const { empleado, token } = await escenario();
    await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);
    const res = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: "Invitación reenviada", data: { envios_restantes_24h: 2 } });
    expect(outbox).toHaveLength(2);
    expect(tokenDelCorreo(outbox[0])).not.toBe(tokenDelCorreo(outbox[1]));

    const invitaciones = await invitacionesDe(empleado.id_empleado);
    expect(invitaciones.map((i) => [i.vigente, i.intentos_reenvio])).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it("409 si nunca se invitó a ese email", async () => {
    const { empleado, token } = await escenario();
    const res = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("usa enviar");
  });

  it("máximo 4 correos al mismo email en 24 horas; indica desde cuándo se puede volver a enviar", async () => {
    const { empleado, token } = await escenario();
    await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`);
    for (let i = 0; i < 3; i++) {
      expect((await api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`)).status).toBe(201);
    }
    const quinto = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`);
    expect(quinto.status).toBe(409);
    expect(quinto.body.message).toMatch(/Ya se enviaron 4 invitaciones .* desde \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(outbox).toHaveLength(4);

    // Enviar tampoco sirve para saltarse el límite (aunque la última se invalide).
    await pool.query("UPDATE invitaciones_empleado SET expiracion = NOW() WHERE id_empleado = ?", [empleado.id_empleado]);
    expect((await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`)).status).toBe(409);
  });

  it("pasadas 24 horas se puede volver a invitar", async () => {
    const { empleado, token } = await escenario();
    for (let i = 0; i < 4; i++) await crearInvitacion(empleado, { expiracion: "2020-01-01 00:00:00" });
    await pool.query(
      "UPDATE invitaciones_empleado SET fecha_creacion = NOW() - INTERVAL 25 HOUR WHERE id_empleado = ?",
      [empleado.id_empleado]
    );
    const res = await api(token).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`);
    expect(res.status).toBe(201);
    expect(res.body.data.envios_restantes_24h).toBe(3);
  });

  it("cambiar el email del empleado empieza un conteo nuevo", async () => {
    const { empleado, token } = await escenario();
    for (let i = 0; i < 4; i++) await crearInvitacion(empleado, { expiracion: "2020-01-01 00:00:00" });
    await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ email: `nuevo_${empleado.id_empleado}@vet.test` });
    expect((await api(token).post(`/empleados/${empleado.id_empleado}/invitacion`)).status).toBe(201);
  });
});
