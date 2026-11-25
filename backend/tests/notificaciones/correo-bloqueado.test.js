import { beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../src/config/db.js";
import { conNotificaciones } from "../../src/modules/notificaciones/notificacion.service.js";
import { crearUsuario, sinSilencio } from "../helpers/factories.js";

// Como con un SMTP real: el mailer no envía a dominios reservados y responde "bloqueado".
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn(async () => ({ delivered: false, mode: "bloqueado" })) }));
vi.mock("../../src/shared/utils/mailer.js", async (original) => ({ ...(await original()), sendMail }));

beforeEach(async () => {
  sendMail.mockClear();
  await sinSilencio();
});

describe("notificaciones por correo a un dominio reservado", () => {
  it("el envío queda omitido con el motivo, no como enviado ni para reintentar", async () => {
    const dueno = await crearUsuario();
    await conNotificaciones((conn, notificarEn) =>
      notificarEn([
        {
          tipo: "cita_cancelada",
          id_negocio: null,
          datos: { fecha: "2026-10-12", hora_inicio: "09:00:00", negocio: "Clínica Patitas", sucursal: "Sede Centro", direccion: "Calle 23", mascota: "Max", servicio: "Consulta", motivo: null },
          enlace: { id_cita: 77 },
          destinatarios: [{ id_usuario: dueno.id_usuario, rol: "dueno" }],
        },
      ])
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [envios] = await pool.query(
      `SELECT e.canal, e.estado, e.error FROM notificaciones_envios e
       JOIN notificaciones n ON n.id_notificacion = e.id_notificacion WHERE n.id_usuario = ?`,
      [dueno.id_usuario]
    );
    expect(envios).toEqual([{ canal: "email", estado: "omitido", error: "Dominio reservado: no recibe correo" }]);
  });
});
