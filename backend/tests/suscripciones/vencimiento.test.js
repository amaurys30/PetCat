import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { vencerSuscripciones } from "../../src/modules/suscripciones/suscripcion.jobs.js";
import { crearDispositivo, crearEmpleado, crearNegocio, crearUsuario, sinSilencio } from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

/**
 * Job de suscripciones (2.4). Usa la fecha real: las suscripciones de cada test son
 * relativas a hoy (con fechas lejanas vencería también las del seed y de otros archivos).
 */

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await sinSilencio();
});
afterEach(() => pushSender.reiniciar());

const dia = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/**
 * Negocio "Clínica Patitas" con una administradora (configuracion.editar) y una
 * recepcionista (sin ese permiso), y su suscripción vigente reemplazada por `suscripcion`:
 * { plan, estado: "en_prueba" | "activa", fin } (fin en días desde hoy).
 */
const negocioCon = async ({ plan = "Pro", estado = "en_prueba", fin }, overrides = {}) => {
  const negocio = await crearNegocio(null, { nombre: "Clínica Patitas", ...overrides });
  const admin = await crearUsuario();
  await crearEmpleado(negocio, { usuario: admin, rol: "Administrador" });
  const recepcion = await crearUsuario();
  await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });

  await pool.query("UPDATE suscripciones SET estado = 'cancelada' WHERE id_negocio = ?", [negocio.id_negocio]);
  const [result] = await pool.query(
    `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin, fecha_prueba_fin)
     VALUES (?, (SELECT id_plan FROM planes_suscripcion WHERE nombre = ?), ?, ?, ?, ?)`,
    [negocio.id_negocio, plan, estado, dia(fin - 14), dia(fin), estado === "en_prueba" ? dia(fin) : null]
  );
  return { negocio, admin, recepcion, id_suscripcion: result.insertId };
};

const estadoDe = async (id_suscripcion) => {
  const [[row]] = await pool.query("SELECT estado FROM suscripciones WHERE id_suscripcion = ?", [id_suscripcion]);
  return row.estado;
};
const avisosDe = async (usuario) => {
  const [rows] = await pool.query("SELECT tipo, titulo, mensaje FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [
    usuario.id_usuario,
  ]);
  return rows;
};
const correosA = (usuario) => outbox.filter((c) => c.to === usuario.email);

describe("suscripciones vencidas", () => {
  it("la prueba que terminó ayer pasa a vencida con plan_vencido; el propietario sin dispositivo recibe correo", async () => {
    const ctx = await negocioCon({ fin: -1 });
    await vencerSuscripciones();

    expect(await estadoDe(ctx.id_suscripcion)).toBe("vencida");
    const [aviso] = await avisosDe(ctx.negocio.propietario);
    expect(aviso).toMatchObject({ tipo: "plan_vencido", titulo: "Terminó tu prueba del plan Pro" });
    expect(aviso.mensaje).toContain("Terminó la prueba gratuita del plan Pro de Clínica Patitas y el negocio pasó al plan Gratuito.");
    expect((await avisosDe(ctx.admin)).map((a) => a.tipo)).toEqual(["plan_vencido"]);
    expect(await avisosDe(ctx.recepcion)).toEqual([]);

    // Correo solo al propietario (la administradora es personal: sin correo).
    expect(correosA(ctx.negocio.propietario)).toEqual([
      expect.objectContaining({ subject: "Terminó tu prueba del plan Pro en PetCat" }),
    ]);
    expect(correosA(ctx.admin)).toEqual([]);

    // Otra corrida no repite nada.
    await vencerSuscripciones();
    expect(await avisosDe(ctx.negocio.propietario)).toHaveLength(1);
  });

  it("un plan pago vencido avisa con su texto; con dispositivo, push en lugar de correo", async () => {
    const ctx = await negocioCon({ plan: "Enterprise", estado: "activa", fin: -2 });
    const dispositivo = await crearDispositivo(ctx.negocio.propietario);
    await vencerSuscripciones();

    expect(await estadoDe(ctx.id_suscripcion)).toBe("vencida");
    const [aviso] = await avisosDe(ctx.negocio.propietario);
    expect(aviso.titulo).toBe("Venció tu plan Enterprise");
    expect(pushSender.enviados).toContainEqual(
      expect.objectContaining({ to: dispositivo.token_expo, body: "Venció el plan Enterprise de Clínica Patitas. El negocio pasó al plan Gratuito." })
    );
    expect(correosA(ctx.negocio.propietario)).toEqual([]);
  });

  it("respeta notif_email del propietario", async () => {
    const ctx = await negocioCon({ fin: -1 });
    await pool.query("UPDATE usuarios SET notif_email = FALSE WHERE id_usuario = ?", [ctx.negocio.propietario.id_usuario]);
    await vencerSuscripciones();
    expect((await avisosDe(ctx.negocio.propietario)).map((a) => a.tipo)).toEqual(["plan_vencido"]);
    expect(correosA(ctx.negocio.propietario)).toEqual([]);
  });

  it("vigentes o del Gratuito no cambian; un negocio desactivado queda vencido sin avisos", async () => {
    const vigente = await negocioCon({ fin: 10 });
    const gratuito = await crearNegocio();
    const inactivo = await negocioCon({ fin: -1 }, { activo: false });
    await vencerSuscripciones();

    expect(await estadoDe(vigente.id_suscripcion)).toBe("en_prueba");
    const [[filaGratuito]] = await pool.query("SELECT estado FROM suscripciones WHERE id_negocio = ?", [gratuito.id_negocio]);
    expect(filaGratuito.estado).toBe("activa");
    expect(await estadoDe(inactivo.id_suscripcion)).toBe("vencida");
    expect(await avisosDe(inactivo.negocio.propietario)).toEqual([]);
  });
});

describe("prueba por terminar", () => {
  it("a 3 días del fin avisa una sola vez", async () => {
    const ctx = await negocioCon({ fin: 3 });
    const lejos = await negocioCon({ fin: 5 });
    await vencerSuscripciones();

    const [aviso] = await avisosDe(ctx.negocio.propietario);
    expect(aviso).toMatchObject({ tipo: "plan_prueba_por_vencer", titulo: "Tu prueba del plan Pro termina en 3 días" });
    expect(correosA(ctx.negocio.propietario)).toEqual([
      expect.objectContaining({ subject: "Tu prueba del plan Pro en PetCat termina en 3 días" }),
    ]);
    expect(await avisosDe(lejos.negocio.propietario)).toEqual([]);

    // Al día siguiente (quedan 2 días) no se repite.
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    await vencerSuscripciones({ ahora: manana });
    expect(await avisosDe(ctx.negocio.propietario)).toHaveLength(1);
  });

  it("si el job no corrió antes, avisa aunque falte menos (hoy es el último día)", async () => {
    const ctx = await negocioCon({ fin: 0 });
    await vencerSuscripciones();
    expect(await estadoDe(ctx.id_suscripcion)).toBe("en_prueba");
    expect((await avisosDe(ctx.negocio.propietario))[0].titulo).toBe("Tu prueba del plan Pro termina hoy");
  });
});

describe("dos instancias del job de suscripciones", () => {
  it("cada suscripción se vence y se avisa una sola vez", async () => {
    const casos = [];
    for (let i = 0; i < 20; i++) casos.push(await negocioCon({ fin: -1 }));

    const correr = () =>
      enOtroProceso(`
        const { vencerSuscripciones } = await import("./src/modules/suscripciones/suscripcion.jobs.js");
        return vencerSuscripciones();`);
    await Promise.all([correr(), correr()]);

    const propietarios = casos.map((c) => c.negocio.propietario.id_usuario);
    const [avisos] = await pool.query(
      "SELECT id_usuario, COUNT(*) AS n FROM notificaciones WHERE tipo = 'plan_vencido' AND id_usuario IN (?) GROUP BY id_usuario",
      [propietarios]
    );
    expect(avisos).toHaveLength(20);
    expect(avisos.every((a) => a.n === 1)).toBe(true);
    const [estados] = await pool.query("SELECT DISTINCT estado FROM suscripciones WHERE id_suscripcion IN (?)", [
      casos.map((c) => c.id_suscripcion),
    ]);
    expect(estados).toEqual([{ estado: "vencida" }]);
  }, 30_000);
});
