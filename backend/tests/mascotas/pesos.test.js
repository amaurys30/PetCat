import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import { crearCita, crearMascota, crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (dias) => {
  const fecha = new Date(`${HOY}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

const pesosDe = async (id_mascota) => {
  const [rows] = await pool.query(
    "SELECT fecha, peso, origen, id_historial FROM mascota_pesos WHERE id_mascota = ? ORDER BY fecha, id_peso",
    [id_mascota]
  );
  return rows.map((r) => ({ ...r, peso: Number(r.peso) }));
};

describe("historial de peso: lo que anota el dueño", () => {
  it("crear la mascota con peso deja el primer punto; sin peso, ninguno", async () => {
    const token = await tokenDe(await crearUsuario());
    const con = await api(token).post("/mascotas").send({ nombre: "Max", especie: "perro", peso: 28.4 });
    expect(con.status).toBe(201);
    expect(await pesosDe(con.body.data.id_mascota)).toEqual([{ fecha: HOY, peso: 28.4, origen: "dueno", id_historial: null }]);

    const sin = await api(token).post("/mascotas").send({ nombre: "Luna", especie: "gato" });
    expect(await pesosDe(sin.body.data.id_mascota)).toEqual([]);
  });

  it("editar el peso: uno por día (se reemplaza); el mismo peso o vaciarlo no agregan ni borran", async () => {
    const token = await tokenDe(await crearUsuario());
    const { id_mascota } = (await api(token).post("/mascotas").send({ nombre: "Max", especie: "perro", peso: 28 })).body.data;

    await api(token).patch(`/mascotas/${id_mascota}`).send({ peso: 28.6 });
    await api(token).patch(`/mascotas/${id_mascota}`).send({ peso: 28.6 });
    await api(token).patch(`/mascotas/${id_mascota}`).send({ nombre: "Maxi" });
    expect(await pesosDe(id_mascota)).toEqual([{ fecha: HOY, peso: 28.6, origen: "dueno", id_historial: null }]);

    await api(token).patch(`/mascotas/${id_mascota}`).send({ peso: null });
    expect(await pesosDe(id_mascota)).toHaveLength(1);
  });
});

describe("historial de peso: los registros médicos", () => {
  it("un registro con peso agrega un punto; editarlo lo mueve o lo cambia; sin peso, se quita", async () => {
    const cliente = await crearUsuario();
    const mascota = await crearMascota(cliente, { peso: 10 });
    const clinica = await crearNegocio(null);
    await crearCita(clinica, { cliente, mascota, estado: "completada", fecha: sumarDias(-40) });
    const token = await tokenDe(clinica.propietario);

    const creado = await api(token)
      .post(`/negocios/${clinica.id_negocio}/historial`)
      .send({ id_mascota: mascota.id_mascota, tipo: "control", fecha: sumarDias(-40), peso_registro: 10.5 });
    expect(creado.status).toBe(201);
    const { id_historial } = creado.body.data;
    expect(await pesosDe(mascota.id_mascota)).toEqual([
      { fecha: sumarDias(-40), peso: 10.5, origen: "historial", id_historial },
    ]);

    await api(token).patch(`/historial/${id_historial}`).send({ peso_registro: 10.8, fecha: sumarDias(-35) });
    expect(await pesosDe(mascota.id_mascota)).toEqual([
      { fecha: sumarDias(-35), peso: 10.8, origen: "historial", id_historial },
    ]);

    await api(token).patch(`/historial/${id_historial}`).send({ peso_registro: null });
    expect(await pesosDe(mascota.id_mascota)).toEqual([]);
  });
});

describe("GET /mascotas/:id_mascota/pesos", () => {
  it("el dueño ve los puntos de los últimos meses, del más antiguo al más reciente", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno, { peso: 28.4 });
    await pool.query(
      `INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen) VALUES
       (?, 27.1, ?, 'dueno'), (?, 27.8, ?, 'historial'), (?, 28.4, ?, 'dueno')`,
      [mascota.id_mascota, sumarDias(-400), mascota.id_mascota, sumarDias(-90), mascota.id_mascota, sumarDias(-1)]
    );
    const token = await tokenDe(dueno);

    const res = await api(token).get(`/mascotas/${mascota.id_mascota}/pesos`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      peso_actual: 28.4,
      puntos: [
        { fecha: sumarDias(-90), peso: 27.8, origen: "historial" },
        { fecha: sumarDias(-1), peso: 28.4, origen: "dueno" },
      ],
    });

    const dosAnios = await api(token).get(`/mascotas/${mascota.id_mascota}/pesos?meses=24`);
    expect(dosAnios.body.data.puntos).toHaveLength(3);
  });

  it("es solo del dueño: un negocio con cita recibe 403, comparta o no el historial", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno, { peso: 10 });
    const clinicaA = await crearNegocio(null);
    const clinicaB = await crearNegocio(null);
    await crearCita(clinicaA, { cliente: dueno, mascota, estado: "completada", fecha: sumarDias(-20) });
    await crearCita(clinicaB, { cliente: dueno, mascota, estado: "completada", fecha: sumarDias(-10) });
    const tokenA = await tokenDe(clinicaA.propietario);
    const tokenB = await tokenDe(clinicaB.propietario);
    await api(tokenA)
      .post(`/negocios/${clinicaA.id_negocio}/historial`)
      .send({ id_mascota: mascota.id_mascota, tipo: "control", fecha: sumarDias(-20), peso_registro: 10.4 });

    for (const compartir of [true, false]) {
      await pool.query("UPDATE mascotas SET compartir_historial = ? WHERE id_mascota = ?", [compartir, mascota.id_mascota]);
      for (const token of [tokenA, tokenB]) {
        const res = await api(token).get(`/mascotas/${mascota.id_mascota}/pesos`);
        expect(res.status).toBe(403);
        expect(res.body).not.toHaveProperty("data");
      }
    }
  });

  it("el panel ve la evolución del peso solo en resumen-salud, que respeta compartir_historial", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno, { peso: 10 });
    const clinicaA = await crearNegocio(null);
    const clinicaB = await crearNegocio(null);
    await crearCita(clinicaA, { cliente: dueno, mascota, estado: "completada", fecha: sumarDias(-20) });
    await crearCita(clinicaB, { cliente: dueno, mascota, estado: "completada", fecha: sumarDias(-10) });
    const tokenA = await tokenDe(clinicaA.propietario);
    const tokenB = await tokenDe(clinicaB.propietario);
    // A registra un peso en su consulta; el dueño anota otro en la app.
    await api(tokenA)
      .post(`/negocios/${clinicaA.id_negocio}/historial`)
      .send({ id_mascota: mascota.id_mascota, tipo: "control", fecha: sumarDias(-20), peso_registro: 10.4 });
    await api(await tokenDe(dueno)).patch(`/mascotas/${mascota.id_mascota}`).send({ peso: 10.9 });

    const puntosDeB = async () =>
      (await api(tokenB).get(`/negocios/${clinicaB.id_negocio}/mascotas/${mascota.id_mascota}/resumen-salud`)).body.data
        .evolucion_peso.puntos;

    // Compartiendo: B ve el peso que registró A (y nunca el que anotó el dueño, que no es historial clínico).
    expect(await puntosDeB()).toEqual([{ fecha: sumarDias(-20), peso: 10.4 }]);

    // Sin compartir: B no ve el peso registrado por A.
    await api(await tokenDe(dueno)).patch(`/mascotas/${mascota.id_mascota}`).send({ compartir_historial: false });
    expect(await puntosDeB()).toEqual([]);

    // A sigue viendo el suyo.
    const deA = await api(tokenA).get(`/negocios/${clinicaA.id_negocio}/mascotas/${mascota.id_mascota}/resumen-salud`);
    expect(deA.body.data.evolucion_peso.puntos).toEqual([{ fecha: sumarDias(-20), peso: 10.4 }]);
  });

  it("otro usuario 403; eliminada 404; meses fuera de rango 422", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno);
    const eliminada = await crearMascota(dueno, { activo: false });
    expect((await api(await tokenDe(await crearUsuario())).get(`/mascotas/${mascota.id_mascota}/pesos`)).status).toBe(403);
    const token = await tokenDe(dueno);
    expect((await api(token).get(`/mascotas/${eliminada.id_mascota}/pesos`)).status).toBe(404);
    for (const meses of [0, 61, "x"]) {
      expect((await api(token).get(`/mascotas/${mascota.id_mascota}/pesos?meses=${meses}`)).status).toBe(422);
    }
  });
});
