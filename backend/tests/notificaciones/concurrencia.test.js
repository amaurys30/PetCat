import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { withTransaction } from "../../src/shared/utils/transaction.js";
import { aDatetimeSQL } from "../../src/shared/utils/fechas.js";
import { notificar, procesarEnviosPendientes } from "../../src/modules/notificaciones/notificacion.service.js";
import { reclamarEnvio } from "../../src/modules/notificaciones/notificacion.repository.js";
import { configurarSilencio, crearDispositivo, crearUsuario } from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

beforeEach(() => configurarSilencio("21:00", "07:00"));
afterEach(() => pushSender.reiniciar());

// Fechas propias de este archivo para no cruzarse con envíos de otros tests.
const NOCHE = new Date(2027, 2, 10, 22, 0, 0); // 22:00: en silencio
const FIN_SILENCIO = new Date(2027, 2, 11, 7, 0, 0);

/** `n` dueños con un dispositivo cada uno y un aviso no urgente programado para el fin del silencio. */
const avisosProgramados = async (n) => {
  const tokens = [];
  const destinatarios = [];
  for (let i = 0; i < n; i++) {
    const dueno = await crearUsuario();
    tokens.push((await crearDispositivo(dueno)).token_expo);
    destinatarios.push({ id_usuario: dueno.id_usuario, rol: "dueno" });
  }
  await withTransaction((conn) =>
    notificar(
      [
        {
          tipo: "cita_confirmada",
          datos: { fecha: "2027-03-20", hora_inicio: "10:00:00", negocio: "Clínica", sucursal: "Sede", direccion: "Calle 1", mascota: "Max", servicio: "Consulta" },
          enlace: { id_cita: 1 },
          destinatarios,
        },
      ],
      conn,
      { ahora: NOCHE }
    )
  );
  const [envios] = await pool.query(
    `SELECT e.id_envio FROM notificaciones_envios e JOIN dispositivos d ON d.id_dispositivo = e.id_dispositivo
     WHERE d.token_expo IN (?)`,
    [tokens]
  );
  expect(envios).toHaveLength(n);
  return { tokens, ids: envios.map((e) => e.id_envio) };
};

/** Otra instancia que corre el job una vez y devuelve los tokens a los que envió push. */
const procesadorEnOtroProceso = (ahora) =>
  enOtroProceso(`
    const { pushSender } = await import("./src/shared/utils/push.js");
    const { procesarEnviosPendientes } = await import("./src/modules/notificaciones/notificacion.service.js");
    pushSender.retrasoMs = 30; // latencia de Expo: los dos procesos se solapan
    await procesarEnviosPendientes({ ahora: new Date(${ahora.getTime()}) });
    return pushSender.enviados.map((m) => m.to);`);

describe("un envío nunca se procesa dos veces", () => {
  it("dos instancias corriendo el job a la vez envían cada aviso una sola vez", async () => {
    const { tokens, ids } = await avisosProgramados(20);

    const [a, b] = await Promise.all([procesadorEnOtroProceso(FIN_SILENCIO), procesadorEnOtroProceso(FIN_SILENCIO)]);
    const nuestros = [...a, ...b].filter((t) => tokens.includes(t));
    expect(nuestros.sort()).toEqual([...tokens].sort()); // todos, ninguno repetido
    // Los dos procesos trabajaron (si uno solo hubiera hecho todo, la prueba no demostraría nada).
    expect(a.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);
    expect(b.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);

    const [estados] = await pool.query("SELECT estado, intentos FROM notificaciones_envios WHERE id_envio IN (?)", [ids]);
    expect(estados.every((e) => e.estado === "enviado" && e.intentos === 1)).toBe(true);
  }, 30_000);

  it("en el mismo proceso, dos ejecuciones simultáneas tampoco duplican", async () => {
    const { tokens } = await avisosProgramados(10);
    pushSender.retrasoMs = 20;
    await Promise.all([procesarEnviosPendientes({ ahora: FIN_SILENCIO }), procesarEnviosPendientes({ ahora: FIN_SILENCIO })]);
    expect(pushSender.enviados.map((m) => m.to).filter((t) => tokens.includes(t)).sort()).toEqual([...tokens].sort());
  });

  it("si el proceso que lo tomó se cae, otro lo retoma al vencer el apartado de 5 minutos", async () => {
    const { tokens, ids } = await avisosProgramados(1);
    // Un proceso lo reclama y "se cae" sin enviarlo.
    const apartadoHasta = new Date(FIN_SILENCIO.getTime() + 5 * 60_000);
    expect(await reclamarEnvio(ids[0], aDatetimeSQL(FIN_SILENCIO), aDatetimeSQL(apartadoHasta))).toBe(true);

    await procesarEnviosPendientes({ ahora: new Date(FIN_SILENCIO.getTime() + 60_000) });
    expect(pushSender.enviados.filter((m) => tokens.includes(m.to))).toHaveLength(0);

    await procesarEnviosPendientes({ ahora: new Date(apartadoHasta.getTime() + 60_000) });
    expect(pushSender.enviados.filter((m) => tokens.includes(m.to))).toHaveLength(1);
    const [[envio]] = await pool.query("SELECT estado, intentos FROM notificaciones_envios WHERE id_envio = ?", [ids[0]]);
    expect(envio).toEqual({ estado: "enviado", intentos: 2 });
  });
});
