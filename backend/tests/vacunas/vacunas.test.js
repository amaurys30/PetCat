import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHistorial,
  crearMascota,
  crearNegocio,
  crearUsuario,
  crearVacuna,
  tokenDe,
} from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/** Cliente con mascota que tiene cita en la clínica A (con veterinaria) y en la B. */
const contexto = async () => {
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  const clinicaA = await crearNegocio(null, { nombre: "Clínica A" });
  const clinicaB = await crearNegocio(null, { nombre: "Clínica B" });
  const usuarioVet = await crearUsuario();
  const vet = await crearEmpleado(clinicaA, { usuario: usuarioVet, rol: "Veterinario", nombre: "Vera" });
  await crearCita(clinicaA, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -10) });
  await crearCita(clinicaB, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -10) });
  return {
    cliente,
    mascota,
    clinicaA,
    clinicaB,
    vet,
    tokenCliente: await tokenDe(cliente),
    tokenA: await tokenDe(clinicaA.propietario),
    tokenB: await tokenDe(clinicaB.propietario),
    tokenVet: await tokenDe(usuarioVet),
  };
};

const estadoEnDb = async (id_vacuna) => {
  const [[row]] = await pool.query("SELECT estado FROM vacunas WHERE id_vacuna = ?", [id_vacuna]);
  return row.estado;
};

describe("POST /mascotas/:id_mascota/vacunas (dueño)", () => {
  it("registra una vacuna externa marcada como del dueño (el comprobante se sube después)", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenCliente)
      .post(`/mascotas/${ctx.mascota.id_mascota}/vacunas`)
      .send({
        nombre_vacuna: "Triple felina",
        fecha_aplicacion: sumarDias(HOY, -100),
        fecha_proxima: sumarDias(HOY, 265),
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      nombre_vacuna: "Triple felina",
      registrada_por: "dueno",
      tiene_comprobante: false,
      comprobante: null,
      negocio: null,
      empleado: null,
      estado: "al_dia",
    });
    const [[fila]] = await pool.query("SELECT id_negocio, id_usuario_registro FROM vacunas WHERE id_vacuna = ?", [
      res.body.data.id_vacuna,
    ]);
    expect(fila).toEqual({ id_negocio: null, id_usuario_registro: ctx.cliente.id_usuario });
  });

  it("comprobante_url en el body o fechas incoherentes -> 422; mascota fallecida -> 409; ajena -> 403", async () => {
    const ctx = await contexto();
    const url = `/mascotas/${ctx.mascota.id_mascota}/vacunas`;
    const conUrl = await api(ctx.tokenCliente).post(url).send({ nombre_vacuna: "Rabia", fecha_aplicacion: HOY, comprobante_url: "https://x.test/a.jpg" });
    expect(conUrl.body.errors).toEqual({ comprobante_url: "Campo no permitido" });
    const fechas = await api(ctx.tokenCliente).post(url).send({ nombre_vacuna: "Rabia", fecha_aplicacion: HOY, fecha_proxima: HOY });
    expect(fechas.body.errors).toEqual({ fecha_proxima: "Debe ser posterior a fecha_aplicacion" });
    const ajena = await api(await tokenDe(await crearUsuario())).post(url).send({ nombre_vacuna: "Rabia", fecha_aplicacion: HOY });
    expect(ajena.status).toBe(403);

    await pool.query("UPDATE mascotas SET fallecido = TRUE, fecha_fallecimiento = CURDATE() WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    const fallecida = await api(ctx.tokenCliente).post(url).send({ nombre_vacuna: "Rabia", fecha_aplicacion: HOY });
    expect(fallecida.status).toBe(409);
  });
});

describe("POST /negocios/:id_negocio/vacunas", () => {
  it("registra la vacuna del negocio con quien la aplicó; la dosis anterior queda no_aplica y se guarda", async () => {
    const ctx = await contexto();
    const anterior = await crearVacuna(ctx.mascota, {
      nombre_vacuna: "Antirrábica",
      fecha_aplicacion: sumarDias(HOY, -400),
      fecha_proxima: sumarDias(HOY, -35),
    });
    const registro = await crearHistorial(ctx.clinicaA, ctx.mascota, { tipo: "vacunacion" });

    const res = await api(ctx.tokenVet)
      .post(`/negocios/${ctx.clinicaA.id_negocio}/vacunas`)
      .send({
        id_mascota: ctx.mascota.id_mascota,
        nombre_vacuna: "ANTIRRABICA",
        lote: "L-123",
        fecha_aplicacion: HOY,
        fecha_proxima: sumarDias(HOY, 365),
        id_historial_medico: registro.id_historial,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      registrada_por: "negocio",
      tiene_comprobante: false,
      estado: "al_dia",
      negocio: { id_negocio: ctx.clinicaA.id_negocio, nombre: "Clínica A" },
      empleado: { id_empleado: ctx.vet.id_empleado },
      id_historial_medico: registro.id_historial,
    });
    expect(await estadoEnDb(anterior.id_vacuna)).toBe("no_aplica");

    const carnet = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    expect(carnet.body.data.map((v) => [v.registrada_por, v.estado])).toEqual([
      ["negocio", "al_dia"],
      ["dueno", "no_aplica"],
    ]);
  });

  it("id_historial_medico de otro negocio -> 422; sin cita válida -> 403", async () => {
    const ctx = await contexto();
    const deB = await crearHistorial(ctx.clinicaB, ctx.mascota);
    const res = await api(ctx.tokenA)
      .post(`/negocios/${ctx.clinicaA.id_negocio}/vacunas`)
      .send({ id_mascota: ctx.mascota.id_mascota, nombre_vacuna: "Rabia", fecha_aplicacion: HOY, id_historial_medico: deB.id_historial });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_historial_medico: "Debe ser un registro de este negocio para esta mascota" });

    const otro = await crearNegocio();
    const sinCita = await api(await tokenDe(otro.propietario))
      .post(`/negocios/${otro.id_negocio}/vacunas`)
      .send({ id_mascota: ctx.mascota.id_mascota, nombre_vacuna: "Rabia", fecha_aplicacion: HOY });
    expect(sinCita.status).toBe(403);
  });
});

describe("GET /negocios/:id_negocio/mascotas/:id_mascota/vacunas", () => {
  it("con compartir_historial en false las vacunas siguen visibles, también las de otros negocios y del dueño", async () => {
    const ctx = await contexto();
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Rabia", comprobante_url: "https://cdn.petcat.test/c.jpg" });
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Parvovirus", id_negocio: ctx.clinicaB.id_negocio });
    await pool.query("UPDATE mascotas SET compartir_historial = FALSE WHERE id_mascota = ?", [ctx.mascota.id_mascota]);

    const res = await api(ctx.tokenA).get(`/negocios/${ctx.clinicaA.id_negocio}/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((v) => [v.nombre_vacuna, v.registrada_por, v.tiene_comprobante]).sort()).toEqual([
      ["Parvovirus", "negocio", false],
      ["Rabia", "dueno", true],
    ]);
  });

  it("sin vacunas.ver -> 403", async () => {
    const ctx = await contexto();
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario, rol: "Recepcionista" });
    const res = await api(await tokenDe(usuario)).get(`/negocios/${ctx.clinicaA.id_negocio}/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /vacunas/:id_vacuna", () => {
  it("el dueño edita las suyas y el estado se recalcula; no puede enviar campos del negocio", async () => {
    const ctx = await contexto();
    const vacuna = await crearVacuna(ctx.mascota, { fecha_aplicacion: sumarDias(HOY, -300), fecha_proxima: sumarDias(HOY, 200) });
    const res = await api(ctx.tokenCliente).patch(`/vacunas/${vacuna.id_vacuna}`).send({ fecha_proxima: sumarDias(HOY, 10) });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("proximo");
    expect(await estadoEnDb(vacuna.id_vacuna)).toBe("proximo");

    const campos = await api(ctx.tokenCliente).patch(`/vacunas/${vacuna.id_vacuna}`).send({ id_empleado: ctx.vet.id_empleado });
    expect(campos.status).toBe(422);
    expect(campos.body.errors).toEqual({ id_empleado: "Solo lo registra el negocio" });
  });

  it("la del dueño no la edita un negocio; la de un negocio no la edita el dueño ni otro negocio", async () => {
    const ctx = await contexto();
    const delDueno = await crearVacuna(ctx.mascota);
    const deA = await crearVacuna(ctx.mascota, { nombre_vacuna: "Rabia", id_negocio: ctx.clinicaA.id_negocio });

    const negocioSobreDueno = await api(ctx.tokenA).patch(`/vacunas/${delDueno.id_vacuna}`).send({ lote: "X" });
    expect(negocioSobreDueno.status).toBe(403);
    // La vacuna del dueño no tiene negocio: el negocio no pasa authorizeDuenoO (no es el dueño).
    expect(negocioSobreDueno.body.message).toBe("No tienes acceso a este recurso");

    const duenoSobreNegocio = await api(ctx.tokenCliente).patch(`/vacunas/${deA.id_vacuna}`).send({ lote: "X" });
    expect(duenoSobreNegocio.status).toBe(403);
    expect(duenoSobreNegocio.body.message).toBe("Solo el negocio que la registró puede editar esta vacuna");

    expect((await api(ctx.tokenB).patch(`/vacunas/${deA.id_vacuna}`).send({ lote: "X" })).status).toBe(403);
    // El rol Veterinario del sistema tiene vacunas.editar (migración 011).
    const propia = await api(ctx.tokenVet).patch(`/vacunas/${deA.id_vacuna}`).send({ lote: "L-9" });
    expect(propia.status).toBe(200);
    expect(propia.body.data.lote).toBe("L-9");
    expect((await api(ctx.tokenA).patch("/vacunas/999999999").send({ lote: "X" })).status).toBe(404);
  });
});

describe("rastro de ediciones de las vacunas (023)", () => {
  const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);

  it("cada edición queda con quién, cuándo, los campos y sus valores anteriores; sin cambios no hay edición", async () => {
    const ctx = await contexto();
    const creada = await api(ctx.tokenA).post(`/negocios/${ctx.clinicaA.id_negocio}/vacunas`).send({
      id_mascota: ctx.mascota.id_mascota,
      nombre_vacuna: "Antirrábica",
      fecha_aplicacion: sumarDias(HOY, -5),
      fecha_proxima: sumarDias(HOY, 360),
      lote: "RB-1",
    });
    expect(creada.body.data).toMatchObject({ edicion: null, ediciones: 0 });
    const url = `/vacunas/${creada.body.data.id_vacuna}`;

    const igual = await api(ctx.tokenVet).patch(url).send({ lote: "RB-1" });
    expect(igual.body.data).toMatchObject({ edicion: null, ediciones: 0 });

    const res = await api(ctx.tokenVet).patch(url).send({ lote: "RB-2", fecha_proxima: sumarDias(HOY, 365) });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ediciones: 1, edicion: { usuario: { id_usuario: ctx.vet.id_usuario } } });
    const [[edicion]] = await pool.query("SELECT id_usuario, campos, valores_anteriores FROM vacunas_ediciones WHERE id_vacuna = ?", [
      creada.body.data.id_vacuna,
    ]);
    expect(parse(edicion.campos).sort()).toEqual(["fecha_proxima", "lote"]);
    expect(parse(edicion.valores_anteriores)).toEqual({ lote: "RB-1", fecha_proxima: sumarDias(HOY, 360) });

    // Otro negocio ve en el carnet que se editó.
    const enB = await api(ctx.tokenB).get(`/negocios/${ctx.clinicaB.id_negocio}/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    expect(enB.body.data.find((v) => v.id_vacuna === creada.body.data.id_vacuna)).toMatchObject({ ediciones: 1 });
  });

  it("el dueño también deja constancia al editar la suya", async () => {
    const ctx = await contexto();
    const creada = await api(ctx.tokenCliente)
      .post(`/mascotas/${ctx.mascota.id_mascota}/vacunas`)
      .send({ nombre_vacuna: "Moquillo", fecha_aplicacion: sumarDias(HOY, -20) });
    const res = await api(ctx.tokenCliente).patch(`/vacunas/${creada.body.data.id_vacuna}`).send({ laboratorio: "Zoetis" });
    expect(res.body.data).toMatchObject({ ediciones: 1, edicion: { usuario: { id_usuario: ctx.cliente.id_usuario } } });
  });
});
