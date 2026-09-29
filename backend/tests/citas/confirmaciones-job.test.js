import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { aDatetimeSQL, hoyISO } from "../../src/shared/utils/fechas.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { procesarConfirmaciones } from "../../src/modules/citas/cita.confirmacion.js";
import { api } from "../helpers/api.js";
import {
  configurarSilencio,
  crearCita,
  crearDispositivo,
  crearEmpleado,
  crearMascota,
  crearNegocio,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  sinSilencio,
  tokenDe,
} from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

/**
 * Job de confirmaciones (2.5). Usa horas relativas a la hora real: la cancelación toma toda
 * pendiente vencida (sin ventana), así que con fechas lejanas cancelaría las de otros archivos.
 */

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await sinSilencio();
});
afterEach(() => pushSender.reiniciar());

const MIN = 60_000;
const enMin = (min) => new Date(Date.now() + min * MIN);
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Negocio "Clínica Patitas" con quien puede confirmar (citas.editar) y quien solo ve la agenda
 * (citas.ver), y un cliente sin dispositivo con su perro Max.
 */
const contexto = async () => {
  const negocio = await crearNegocio(null, { nombre: "Clínica Patitas" });
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Centro", direccion: "Calle 23 # 18-45" });
  const servicio = await crearServicio(negocio, { nombre: "Consulta general" });
  const editor = await crearUsuario();
  await crearEmpleado(negocio, { usuario: editor, rol: (await crearRol(negocio, { citas: ["ver", "editar"] })).id_rol });
  const lector = await crearUsuario();
  await crearEmpleado(negocio, { usuario: lector, rol: (await crearRol(negocio, { citas: ["ver"] })).id_rol });
  const cliente = await crearUsuario({ nombre: "Laura" });
  const mascota = await crearMascota(cliente, { nombre: "Max" });
  return { negocio, sucursal, servicio, editor, lector, cliente, mascota };
};

/** Cita pendiente creada hace `creadaMin` minutos, con plazo en `plazoMin` e inicio en `inicioMin` (desde ahora). */
const pendiente = async (ctx, { creadaMin, plazoMin, inicioMin }) => {
  const inicio = enMin(inicioMin);
  const fin = new Date(inicio.getTime() + 30 * MIN);
  return crearCita(ctx.negocio, {
    cliente: ctx.cliente,
    mascota: ctx.mascota,
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    fecha: hoyISO(inicio),
    hora_inicio: `${hhmm(inicio)}:00`,
    hora_fin: `${hhmm(fin)}:00`,
    estado: "pendiente",
    fecha_creacion: aDatetimeSQL(enMin(-creadaMin)),
    confirmar_antes_de: aDatetimeSQL(enMin(plazoMin)),
  });
};

const avisosDe = async (usuario, tipo) => {
  const [rows] = await pool.query(
    "SELECT tipo, titulo, mensaje, datos_extra_json FROM notificaciones WHERE id_usuario = ? AND tipo = ? ORDER BY id_notificacion",
    [usuario.id_usuario, tipo]
  );
  return rows;
};
const filaCita = async (id_cita) => {
  const [[row]] = await pool.query("SELECT * FROM citas WHERE id_cita = ?", [id_cita]);
  return row;
};

describe("aviso a mitad del plazo", () => {
  it("avisa una sola vez al propietario y a quien puede confirmar; correo al propietario sin dispositivo", async () => {
    const ctx = await contexto();
    const dispositivo = await crearDispositivo(ctx.editor);
    const cita = await pendiente(ctx, { creadaMin: 120, plazoMin: 60, inicioMin: 180 }); // mitad: hace 30 min

    await procesarConfirmaciones();
    await procesarConfirmaciones();

    for (const quien of [ctx.negocio.propietario, ctx.editor]) {
      expect(await avisosDe(quien, "cita_por_confirmar")).toHaveLength(1);
    }
    expect(await avisosDe(ctx.lector, "cita_por_confirmar")).toEqual([]); // solo ve la agenda, no puede confirmar
    const [aviso] = await avisosDe(ctx.editor, "cita_por_confirmar");
    expect(aviso.mensaje).toMatch(/^La cita de Laura Prueba \(Consulta general para Max\) del .+ sigue sin confirmar\. Si no la confirmas antes del .+, se cancelará sola\.$/);
    expect((await filaCita(cita.id_cita)).aviso_por_confirmar_en).not.toBeNull();

    const push = pushSender.enviados.find((m) => m.to === dispositivo.token_expo);
    expect(push.body).not.toMatch(/Laura|Max/);
    expect(outbox.filter((c) => c.to === ctx.negocio.propietario.email).map((c) => c.subject)).toEqual([
      "Tienes una cita sin confirmar en PetCat",
    ]);
    expect(outbox.filter((c) => c.to === ctx.editor.email)).toEqual([]); // personal: sin correo
  });

  it("antes de la mitad no avisa", async () => {
    const ctx = await contexto();
    await pendiente(ctx, { creadaMin: 10, plazoMin: 120, inicioMin: 240 });
    await procesarConfirmaciones();
    expect(await avisosDe(ctx.negocio.propietario, "cita_por_confirmar")).toEqual([]);
  });
});

describe("cancelación automática", () => {
  it("al vencer el plazo la cancela el sistema, avisa a las dos partes y no cuenta contra el cliente", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, { creadaMin: 180, plazoMin: -1, inicioMin: 120 });
    const resultado = await procesarConfirmaciones();
    expect(resultado.canceladas).toBeGreaterThanOrEqual(1);

    expect(await filaCita(cita.id_cita)).toMatchObject({
      estado: "cancelada",
      cancelada_por: "sistema",
      cancelacion_tardia: 0,
      motivo_cancelacion: "El negocio no confirmó la cita a tiempo",
    });
    // El plazo ya venció: no se manda el aviso de mitad de plazo, la cancelación lo reemplaza.
    expect(await avisosDe(ctx.negocio.propietario, "cita_por_confirmar")).toEqual([]);

    // Al dueño: que el negocio no confirmó a tiempo y los ids para reservar de nuevo.
    const [alDueno] = await avisosDe(ctx.cliente, "cita_no_confirmada");
    expect(alDueno.mensaje).toMatch(/^Clínica Patitas no confirmó a tiempo la cita de Max \(Consulta general\) del .+ y se canceló\. No tienes que hacer nada\. Puedes reservar de nuevo desde la app\.$/);
    expect(alDueno.datos_extra_json.enlace).toEqual({
      tipo: "cita_no_confirmada",
      id_cita: cita.id_cita,
      id_negocio: ctx.negocio.id_negocio,
      id_sucursal: ctx.sucursal.id_sucursal,
      id_servicio: ctx.servicio.id_servicio,
      id_mascota: ctx.mascota.id_mascota,
    });
    // Al negocio: a quien ve la agenda y al propietario.
    expect(await avisosDe(ctx.lector, "cita_no_confirmada")).toHaveLength(1);
    expect(await avisosDe(ctx.negocio.propietario, "cita_no_confirmada")).toHaveLength(1);
    // Correos: dueño y propietario sin dispositivo.
    expect(outbox.find((c) => c.to === ctx.cliente.email).subject).toBe("Tu cita en Clínica Patitas se canceló");
    expect(outbox.find((c) => c.to === ctx.negocio.propietario.email).subject).toBe("Se canceló una cita sin confirmar en PetCat");

    const tokenPropietario = await tokenDe(ctx.negocio.propietario);
    const historial = await api(await tokenDe(ctx.cliente)).get(`/citas/${cita.id_cita}/historial`);
    expect(historial.body.data.at(-1)).toMatchObject({ valor_nuevo: "cancelada", realizado_por: "sistema" });
    const detalle = await api(tokenPropietario).get(`/citas/${cita.id_cita}`);
    expect(detalle.body.data.cancelacion).toMatchObject({ por: "sistema", tardia: false });
    expect(detalle.body.data.cliente.historial_cumplimiento.cancelaciones_tardias).toBe(0);

    // Otra corrida no repite nada.
    await procesarConfirmaciones();
    expect(await avisosDe(ctx.cliente, "cita_no_confirmada")).toHaveLength(1);
  });

  it("la que el negocio confirmó a tiempo no se toca", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, { creadaMin: 180, plazoMin: 5, inicioMin: 120 });
    const res = await api(await tokenDe(ctx.editor)).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" });
    expect(res.status).toBe(200);
    await pool.query("UPDATE citas SET confirmar_antes_de = ? WHERE id_cita = ?", [aDatetimeSQL(enMin(-1)), cita.id_cita]);

    await procesarConfirmaciones();
    expect((await filaCita(cita.id_cita)).estado).toBe("confirmada");
  });

  it("tras una caída, la que ya empezó se cancela sin avisar a nadie", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, { creadaMin: 300, plazoMin: -120, inicioMin: -30 });
    await procesarConfirmaciones();
    expect((await filaCita(cita.id_cita)).cancelada_por).toBe("sistema");
    expect(await avisosDe(ctx.cliente, "cita_no_confirmada")).toEqual([]);
    expect(await avisosDe(ctx.negocio.propietario, "cita_no_confirmada")).toEqual([]);
  });

  it("en horario de silencio: urgente para el dueño si la cita está cerca, nunca para el negocio", async () => {
    // Silencio desde hace una hora hasta dentro de una hora.
    await configurarSilencio(hhmm(enMin(-60)), hhmm(enMin(60)));
    const ctx = await contexto();
    const alDueno = await crearDispositivo(ctx.cliente);
    const alEditor = await crearDispositivo(ctx.editor);
    const alLector = await crearDispositivo(ctx.lector);
    await pendiente(ctx, { creadaMin: 180, plazoMin: -1, inicioMin: 90 }); // se cancela ahora
    const otro = await contexto();
    const alEditorOtro = await crearDispositivo(otro.editor);
    await pendiente(otro, { creadaMin: 120, plazoMin: 60, inicioMin: 180 }); // aviso de mitad de plazo

    await procesarConfirmaciones();
    const enviados = (token) => pushSender.enviados.filter((m) => m.to === token);
    expect(enviados(alDueno.token_expo)).toEqual([expect.objectContaining({ priority: "high" })]);
    expect(enviados(alLector.token_expo)).toEqual([]); // espera el fin del silencio
    expect(enviados(alEditor.token_expo)).toEqual([]);
    expect(enviados(alEditorOtro.token_expo)).toEqual([]); // el aviso de mitad de plazo nunca es urgente
    expect(await avisosDe(otro.editor, "cita_por_confirmar")).toHaveLength(1); // en la app sí, de inmediato
  });

  it("si el negocio confirma mientras corre el job, queda un solo resultado", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, { creadaMin: 180, plazoMin: -1, inicioMin: 120 });
    const [res] = await Promise.all([
      api(await tokenDe(ctx.editor)).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" }),
      procesarConfirmaciones(),
    ]);

    const { estado } = await filaCita(cita.id_cita);
    if (estado === "confirmada") {
      expect(res.status).toBe(200);
      expect(await avisosDe(ctx.cliente, "cita_no_confirmada")).toEqual([]);
    } else {
      expect(estado).toBe("cancelada");
      expect(res.status).toBe(409);
      expect(await avisosDe(ctx.cliente, "cita_confirmada")).toEqual([]);
    }
  });
});

describe("dos instancias del job de confirmaciones", () => {
  it("cada aviso y cada cancelación ocurren una sola vez", async () => {
    const porAvisar = [];
    const porCancelar = [];
    for (let i = 0; i < 10; i++) {
      const a = await contexto();
      await pendiente(a, { creadaMin: 120, plazoMin: 60, inicioMin: 180 });
      porAvisar.push(a);
      const c = await contexto();
      await pendiente(c, { creadaMin: 180, plazoMin: -1, inicioMin: 120 });
      porCancelar.push(c);
    }

    const correr = () =>
      enOtroProceso(`
        const { procesarConfirmaciones } = await import("./src/modules/citas/cita.confirmacion.js");
        return procesarConfirmaciones();`);
    const [uno, dos] = await Promise.all([correr(), correr()]);
    expect(uno.canceladas + dos.canceladas).toBeGreaterThanOrEqual(10);

    const contar = async (usuarios, tipo) => {
      const [rows] = await pool.query(
        "SELECT id_usuario, COUNT(*) AS n FROM notificaciones WHERE tipo = ? AND id_usuario IN (?) GROUP BY id_usuario",
        [tipo, usuarios.map((u) => u.id_usuario)]
      );
      return rows;
    };
    const avisos = await contar(porAvisar.map((c) => c.negocio.propietario), "cita_por_confirmar");
    expect(avisos).toHaveLength(10);
    expect(avisos.every((r) => r.n === 1)).toBe(true);
    const cancelaciones = await contar(porCancelar.map((c) => c.cliente), "cita_no_confirmada");
    expect(cancelaciones).toHaveLength(10);
    expect(cancelaciones.every((r) => r.n === 1)).toBe(true);
  }, 30_000);
});
