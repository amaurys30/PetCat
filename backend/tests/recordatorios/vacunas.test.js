import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { enviarRecordatoriosVacunas } from "../../src/modules/recordatorios/recordatorio.service.js";
import { refrescarEstados } from "../../src/modules/vacunas/vacuna.service.js";
import { api } from "../helpers/api.js";
import { configurarSilencio, crearDispositivo, crearMascota, crearUsuario, crearVacuna, tokenDe } from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

/**
 * Jobs de vacunas (2.4). Los recordatorios usan fechas en 2031 y 2032, cada test las suyas:
 * el job solo mira vacunas con un hito entre hoy y 2 días antes, así que no toca las de
 * otros archivos. El refresco de estados usa la fecha real (corrige la columna de todas).
 */

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await configurarSilencio("21:00", "07:00");
});
afterEach(() => pushSender.reiniciar());

const nueve = (fecha) => new Date(`${fecha}T09:00:00`);

/** Dueño con dispositivo (o sin él), su mascota Luna y una vacuna Antirrábica con esa fecha_proxima. */
const vacunaDe = async (fecha_proxima, { conDispositivo = true, mascota: extraMascota = {}, usuario: extraUsuario = {} } = {}) => {
  const dueno = await crearUsuario(extraUsuario);
  const dispositivo = conDispositivo ? await crearDispositivo(dueno) : null;
  const mascota = await crearMascota(dueno, { nombre: "Luna", ...extraMascota });
  const vacuna = await crearVacuna(mascota, { fecha_aplicacion: "2030-06-01", fecha_proxima });
  return { dueno, dispositivo, mascota, vacuna };
};

const tiposDe = async (usuario) => {
  const [rows] = await pool.query("SELECT tipo FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [usuario.id_usuario]);
  return rows.map((r) => r.tipo);
};

describe("recordatorios de vacunas", () => {
  it("7 días antes, el día y 7 días después, una vez cada uno", async () => {
    const { dueno, dispositivo, vacuna } = await vacunaDe("2031-06-15");

    await enviarRecordatoriosVacunas({ ahora: nueve("2031-06-08") });
    await enviarRecordatoriosVacunas({ ahora: nueve("2031-06-08") }); // otra corrida el mismo día
    await enviarRecordatoriosVacunas({ ahora: nueve("2031-06-09") }); // dentro de la gracia: ya se avisó
    expect(await tiposDe(dueno)).toEqual(["vacuna_proxima"]);

    const [[notificacion]] = await pool.query("SELECT titulo, mensaje, datos_extra_json FROM notificaciones WHERE id_usuario = ?", [
      dueno.id_usuario,
    ]);
    expect(notificacion.titulo).toBe("Vacuna próxima");
    expect(notificacion.mensaje).toBe("La vacuna Antirrábica de Luna vence el domingo, 15 de junio. Agenda la aplicación con tu veterinaria.");
    expect(notificacion.datos_extra_json.enlace).toEqual({
      tipo: "vacuna_proxima",
      id_mascota: vacuna.id_mascota,
      id_vacuna: vacuna.id_vacuna,
    });
    // La push no lleva mascota ni vacuna.
    expect(pushSender.enviados).toEqual([
      expect.objectContaining({
        to: dispositivo.token_expo,
        body: "Una vacuna de tu mascota vence en una semana. Abre PetCat para ver el carnet.",
        data: expect.objectContaining({ id_vacuna: vacuna.id_vacuna }),
      }),
    ]);

    for (const dia of ["2031-06-10", "2031-06-14", "2031-06-15", "2031-06-16", "2031-06-21", "2031-06-22", "2031-06-25", "2031-07-15"]) {
      await enviarRecordatoriosVacunas({ ahora: nueve(dia) });
    }
    expect(await tiposDe(dueno)).toEqual(["vacuna_proxima", "vacuna_vence_hoy", "vacuna_vencida"]);

    const [marcas] = await pool.query("SELECT hito, tipo, estado FROM recordatorios WHERE id_vacuna = ? ORDER BY hito", [vacuna.id_vacuna]);
    expect(marcas).toEqual([
      { hito: -7, tipo: "vacuna_proxima", estado: "enviado" },
      { hito: 0, tipo: "vacuna_proxima", estado: "enviado" },
      { hito: 7, tipo: "vacuna_vencida", estado: "enviado" },
    ]);
  });

  it("2 días de gracia por si el job no corrió, sin avisos retroactivos", async () => {
    const tarde = await vacunaDe("2031-07-15"); // hito -7 el 8 de julio: se envía hasta el 10
    const muyTarde = await vacunaDe("2031-07-20"); // hito -7 el 13: el 16 ya pasó la gracia
    const registradaVencida = await vacunaDe("2031-06-01"); // +7 fue el 8 de junio

    await enviarRecordatoriosVacunas({ ahora: nueve("2031-07-10") });
    expect(await tiposDe(tarde.dueno)).toEqual(["vacuna_proxima"]);

    await enviarRecordatoriosVacunas({ ahora: nueve("2031-07-16") });
    expect(await tiposDe(muyTarde.dueno)).toEqual([]);
    expect(await tiposDe(registradaVencida.dueno)).toEqual([]);
  });

  it("sin dispositivo llega por correo, sin nombrar la mascota ni la vacuna", async () => {
    const { dueno } = await vacunaDe("2031-08-15", { conDispositivo: false });
    await enviarRecordatoriosVacunas({ ahora: nueve("2031-08-15") });

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: dueno.email, subject: "Hoy vence una vacuna de tu mascota" });
    expect(outbox[0].text).not.toMatch(/Luna|Antirrábica/);
  });

  it("no avisa por una dosis reemplazada, una mascota fallecida o inactiva, ni a un dueño inactivo", async () => {
    const reemplazada = await vacunaDe("2031-09-15");
    // Dosis más reciente de la misma vacuna, con otra fecha: la anterior deja de estar vigente.
    await crearVacuna(reemplazada.mascota, { nombre_vacuna: "antirrabica", fecha_aplicacion: "2031-01-10", fecha_proxima: "2032-01-10" });
    const fallecida = await vacunaDe("2031-09-15", { mascota: { fallecido: true } });
    const inactiva = await vacunaDe("2031-09-15", { mascota: { activo: false } });
    const duenoInactivo = await vacunaDe("2031-09-15", { usuario: { activo: false } });

    await enviarRecordatoriosVacunas({ ahora: nueve("2031-09-08") });
    for (const caso of [reemplazada, fallecida, inactiva, duenoInactivo]) {
      expect(await tiposDe(caso.dueno)).toEqual([]);
    }
  });

  it("si cambia fecha_proxima, los hitos vuelven a empezar", async () => {
    const { dueno, vacuna } = await vacunaDe("2031-10-15");
    await enviarRecordatoriosVacunas({ ahora: nueve("2031-10-08") });
    expect(await tiposDe(dueno)).toEqual(["vacuna_proxima"]);

    const res = await api(await tokenDe(dueno)).patch(`/vacunas/${vacuna.id_vacuna}`).send({ fecha_proxima: "2031-11-15" });
    expect(res.status).toBe(200);
    const [marcas] = await pool.query("SELECT 1 FROM recordatorios WHERE id_vacuna = ?", [vacuna.id_vacuna]);
    expect(marcas).toHaveLength(0);

    await enviarRecordatoriosVacunas({ ahora: nueve("2031-11-08") });
    expect(await tiposDe(dueno)).toEqual(["vacuna_proxima", "vacuna_proxima"]);
  });
});

describe("dos instancias del job de vacunas", () => {
  it("cada hito se avisa una sola vez", async () => {
    const casos = [];
    for (let i = 0; i < 20; i++) casos.push(await vacunaDe("2032-06-15"));
    const tokens = casos.map((c) => c.dispositivo.token_expo);
    const ahora = nueve("2032-06-08");

    const correr = () =>
      enOtroProceso(`
        const { pushSender } = await import("./src/shared/utils/push.js");
        const { enviarRecordatoriosVacunas } = await import("./src/modules/recordatorios/recordatorio.service.js");
        pushSender.retrasoMs = 30; // latencia de Expo: los dos procesos se solapan
        await enviarRecordatoriosVacunas({ ahora: new Date(${ahora.getTime()}) });
        return pushSender.enviados.map((m) => m.to);`);
    const [uno, dos] = await Promise.all([correr(), correr()]);

    const nuestros = [...uno, ...dos].filter((t) => tokens.includes(t));
    expect(nuestros.sort()).toEqual([...tokens].sort()); // todos, ninguno repetido
    expect(uno.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);
    expect(dos.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);

    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'vacuna_proxima' AND id_usuario IN (?)", [
      casos.map((c) => c.dueno.id_usuario),
    ]);
    expect(n).toBe(20);
  }, 30_000);
});

describe("refresco de vacunas.estado", () => {
  const sumarDias = (dias) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return hoyISO(fecha);
  };
  const estadoDe = async (vacuna) => {
    const [[row]] = await pool.query("SELECT estado FROM vacunas WHERE id_vacuna = ?", [vacuna.id_vacuna]);
    return row.estado;
  };

  it("corrige los estados guardados que cambiaron con los días, sin tocar no_aplica", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno);
    const aProximo = await crearVacuna(mascota, { nombre_vacuna: "Moquillo", fecha_aplicacion: "2025-01-01", fecha_proxima: sumarDias(10), estado: "al_dia" });
    const aVencido = await crearVacuna(mascota, { nombre_vacuna: "Parvovirus", fecha_aplicacion: "2025-01-01", fecha_proxima: sumarDias(-1), estado: "proximo" });
    const aAlDia = await crearVacuna(mascota, { nombre_vacuna: "Leptospira", fecha_aplicacion: "2025-01-01", fecha_proxima: sumarDias(90), estado: "vencido" });
    const reemplazada = await crearVacuna(mascota, { nombre_vacuna: "Rabia", fecha_aplicacion: "2024-01-01", fecha_proxima: sumarDias(-100), estado: "no_aplica" });
    await crearVacuna(mascota, { nombre_vacuna: "Rabia", fecha_aplicacion: "2025-06-01", fecha_proxima: sumarDias(200), estado: "al_dia" });

    expect(await refrescarEstados()).toBeGreaterThanOrEqual(1);
    expect(await estadoDe(aProximo)).toBe("proximo");
    expect(await estadoDe(aVencido)).toBe("vencido");
    expect(await estadoDe(aAlDia)).toBe("al_dia");
    expect(await estadoDe(reemplazada)).toBe("no_aplica");

    // Idempotente: ya no queda nada que corregir para esta mascota.
    const [pendientes] = await pool.query(
      `SELECT 1 FROM vacunas WHERE id_mascota = ? AND estado <> 'no_aplica' AND estado <> CASE
         WHEN fecha_proxima IS NULL THEN 'al_dia' WHEN fecha_proxima < CURDATE() THEN 'vencido'
         WHEN fecha_proxima <= CURDATE() + INTERVAL 30 DAY THEN 'proximo' ELSE 'al_dia' END`,
      [mascota.id_mascota]
    );
    expect(pendientes).toHaveLength(0);
  });
});
