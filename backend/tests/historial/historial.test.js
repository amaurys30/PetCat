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
  crearRol,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/**
 * Cliente con una mascota que tiene citas en dos clínicas (A y B). A tiene una
 * veterinaria con cuenta. Cada clínica ya registró una consulta con notas internas.
 */
const contexto = async ({ mascota: extraMascota = {} } = {}) => {
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente, { nombre: "Toby", peso: 10, ...extraMascota });
  const clinicaA = await crearNegocio(null, { nombre: "Clínica A" });
  const clinicaB = await crearNegocio(null, { nombre: "Clínica B" });
  const usuarioVet = await crearUsuario();
  const vet = await crearEmpleado(clinicaA, { usuario: usuarioVet, rol: "Veterinario", nombre: "Vera" });
  const citaA = await crearCita(clinicaA, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -20) });
  await crearCita(clinicaB, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -30) });
  const deA = await crearHistorial(clinicaA, mascota, {
    fecha: sumarDias(HOY, -20),
    diagnostico: "Otitis",
    notas_internas: "Cliente difícil (A)",
  });
  const deB = await crearHistorial(clinicaB, mascota, {
    fecha: sumarDias(HOY, -30),
    diagnostico: "Dermatitis",
    notas_internas: "Nota privada (B)",
  });
  return {
    cliente,
    mascota,
    clinicaA,
    clinicaB,
    vet,
    citaA,
    deA,
    deB,
    tokenCliente: await tokenDe(cliente),
    tokenA: await tokenDe(clinicaA.propietario),
    tokenB: await tokenDe(clinicaB.propietario),
    tokenVet: await tokenDe(usuarioVet),
  };
};

const panel = (ctx, negocio, token) => api(token).get(`/negocios/${negocio.id_negocio}/mascotas/${ctx.mascota.id_mascota}/historial`);

describe("historial médico: lectura", () => {
  it("el dueño ve todos los registros, de todos los negocios, sin notas internas", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((r) => r.diagnostico)).toEqual(["Otitis", "Dermatitis"]);
    expect(res.body.data[0].negocio).toEqual({ id_negocio: ctx.clinicaA.id_negocio, nombre: "Clínica A" });
    expect(JSON.stringify(res.body)).not.toContain("Cliente difícil");
    expect(JSON.stringify(res.body)).not.toContain("Nota privada");
    expect(res.body.data[0]).not.toHaveProperty("es_propio");
  });

  it("un negocio con cita ve todo si se comparte, pero solo sus propias notas internas", async () => {
    const ctx = await contexto();
    const res = await panel(ctx, ctx.clinicaA, ctx.tokenA);

    expect(res.status).toBe(200);
    const [propio, ajeno] = res.body.data;
    expect(propio).toMatchObject({ id_historial: ctx.deA.id_historial, es_propio: true, notas_internas: "Cliente difícil (A)" });
    expect(ajeno).toMatchObject({ id_historial: ctx.deB.id_historial, es_propio: false, diagnostico: "Dermatitis" });
    expect(ajeno).not.toHaveProperty("notas_internas");
  });

  it("con compartir_historial en false, cada negocio ve solo lo que creó", async () => {
    const ctx = await contexto();
    const patch = await api(ctx.tokenCliente).patch(`/mascotas/${ctx.mascota.id_mascota}`).send({ compartir_historial: false });
    expect(patch.body.data.compartir_historial).toBe(false);

    const deA = await panel(ctx, ctx.clinicaA, ctx.tokenA);
    expect(deA.body.data.map((r) => r.id_historial)).toEqual([ctx.deA.id_historial]);
    const deB = await panel(ctx, ctx.clinicaB, ctx.tokenB);
    expect(deB.body.data.map((r) => r.id_historial)).toEqual([ctx.deB.id_historial]);

    const dueno = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(dueno.body.meta.total).toBe(2);
  });

  it("un negocio sin cita válida -> 403 (canceladas y reprogramadas no cuentan); con una pendiente sí", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    const token = await tokenDe(otro.propietario);
    expect((await panel(ctx, otro, token)).status).toBe(403);

    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada" });
    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "reprogramada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const res = await panel(ctx, otro, token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Esta mascota no tiene citas con el negocio");

    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "pendiente", hora_inicio: "11:00:00", hora_fin: "11:30:00" });
    expect((await panel(ctx, otro, token)).status).toBe(200);
  });

  it("mascota eliminada por el dueño -> 404 también para el negocio; sin historial_medico.ver -> 403", async () => {
    const ctx = await contexto();
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario, rol: "Recepcionista" });
    expect((await panel(ctx, ctx.clinicaA, await tokenDe(usuario))).status).toBe(403);

    await pool.query("UPDATE mascotas SET activo = FALSE WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect((await panel(ctx, ctx.clinicaA, ctx.tokenA)).status).toBe(404);
    expect((await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`)).status).toBe(404);
  });

  it("filtra por tipo y fechas; otro usuario -> 403", async () => {
    const ctx = await contexto();
    await crearHistorial(ctx.clinicaA, ctx.mascota, { tipo: "desparasitacion", fecha: sumarDias(HOY, -5) });
    const base = `/mascotas/${ctx.mascota.id_mascota}/historial`;
    const porTipo = await api(ctx.tokenCliente).get(`${base}?tipo=desparasitacion`);
    expect(porTipo.body.data.map((r) => r.tipo)).toEqual(["desparasitacion"]);
    const porFecha = await api(ctx.tokenCliente).get(`${base}?desde=${sumarDias(HOY, -25)}`);
    expect(porFecha.body.meta.total).toBe(2);
    expect((await api(await tokenDe(await crearUsuario())).get(base)).status).toBe(403);
  });
});

describe("POST /negocios/:id_negocio/historial", () => {
  const crear = (ctx, body, token = ctx.tokenVet, negocio = ctx.clinicaA) =>
    api(token).post(`/negocios/${negocio.id_negocio}/historial`).send({ id_mascota: ctx.mascota.id_mascota, ...body });

  it("crea el registro con fecha de hoy y el perfil de empleado de quien registra; actualiza el peso", async () => {
    const ctx = await contexto();
    const res = await crear(ctx, {
      tipo: "consulta_general",
      id_cita: ctx.citaA.id_cita,
      diagnostico: "Sano",
      peso_registro: 12.4,
      temperatura: 38.5,
      proximo_control: sumarDias(HOY, 180),
      notas_internas: "Revisar en 6 meses",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      fecha: HOY,
      id_cita: ctx.citaA.id_cita,
      peso_registro: 12.4,
      temperatura: 38.5,
      archivos: [],
      empleado: { id_empleado: ctx.vet.id_empleado, nombre: "Vera" },
      negocio: { id_negocio: ctx.clinicaA.id_negocio },
      es_propio: true,
      notas_internas: "Revisar en 6 meses",
    });
    const [[mascota]] = await pool.query("SELECT peso FROM mascotas WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect(Number(mascota.peso)).toBe(12.4);
  });

  it("un peso con fecha anterior al último registrado no cambia el peso de la mascota", async () => {
    const ctx = await contexto();
    await crear(ctx, { tipo: "consulta_general", peso_registro: 12 });
    await crear(ctx, { tipo: "consulta_general", peso_registro: 9, fecha: sumarDias(HOY, -60) });
    const [[mascota]] = await pool.query("SELECT peso FROM mascotas WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect(Number(mascota.peso)).toBe(12);
  });

  it("valida la cita, las fechas y que los archivos no vengan en el body -> 422", async () => {
    const ctx = await contexto();
    const citaDeB = await crearCita(ctx.clinicaB, { cliente: ctx.cliente, mascota: ctx.mascota });
    const cancelada = await crearCita(ctx.clinicaA, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada" });
    for (const id_cita of [citaDeB.id_cita, cancelada.id_cita]) {
      const res = await crear(ctx, { tipo: "consulta_general", id_cita });
      expect(res.status).toBe(422);
      expect(res.body.errors).toHaveProperty("id_cita");
    }
    // Los archivos se suben con POST /historial/:id_historial/archivos.
    const conArchivos = await crear(ctx, { tipo: "consulta_general", archivos: ["https://cdn.petcat.test/a.pdf"] });
    expect(conArchivos.body.errors).toEqual({ archivos: "Campo no permitido" });
    const futura = await crear(ctx, { tipo: "consulta_general", fecha: sumarDias(HOY, 1) });
    expect(futura.body.errors).toEqual({ fecha: "No puede ser una fecha futura" });
    const control = await crear(ctx, { tipo: "consulta_general", fecha: sumarDias(HOY, -2), proximo_control: sumarDias(HOY, -3) });
    expect(control.body.errors).toEqual({ proximo_control: "No puede ser anterior a la fecha del registro" });
  });

  it("sin cita válida -> 403; sin historial_medico.crear -> 403", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    expect((await crear(ctx, { tipo: "consulta_general" }, await tokenDe(otro.propietario), otro)).status).toBe(403);
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario, rol: "Recepcionista" });
    expect((await crear(ctx, { tipo: "consulta_general" }, await tokenDe(usuario))).status).toBe(403);
  });
});

describe("PATCH /historial/:id_historial", () => {
  it("solo lo edita el negocio que lo creó", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenVet).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "Otitis externa", notas_internas: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ diagnostico: "Otitis externa", notas_internas: null });

    const ajeno = await api(ctx.tokenB).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "Otra cosa" });
    expect(ajeno.status).toBe(403);
    expect((await api(ctx.tokenCliente).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "X" })).status).toBe(403);
    expect((await api(ctx.tokenA).patch("/historial/999999999").send({ diagnostico: "X" })).status).toBe(404);
  });

  it("valida proximo_control contra la fecha actual del registro; body vacío -> 422", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenA)
      .patch(`/historial/${ctx.deA.id_historial}`)
      .send({ proximo_control: sumarDias(HOY, -25) });
    expect(res.status).toBe(422);
    expect((await api(ctx.tokenA).patch(`/historial/${ctx.deA.id_historial}`).send({})).status).toBe(422);
  });
});

describe("rastro de ediciones y tipo control (022)", () => {
  it("cada edición queda con quién, cuándo, los campos y sus valores anteriores; sin cambios no hay edición", async () => {
    const ctx = await contexto();
    const url = `/historial/${ctx.deA.id_historial}`;
    const nuevo = await api(ctx.tokenA).get(`/negocios/${ctx.clinicaA.id_negocio}/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(nuevo.body.data.find((r) => r.id_historial === ctx.deA.id_historial)).toMatchObject({ edicion: null, ediciones: 0 });

    // Mismos valores: no es una edición.
    const igual = await api(ctx.tokenVet).patch(url).send({ diagnostico: "Otitis" });
    expect(igual.body.data).toMatchObject({ edicion: null, ediciones: 0 });

    const res = await api(ctx.tokenVet).patch(url).send({ diagnostico: "Otitis externa", tipo: "control", temperatura: 38.5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      tipo: "control",
      ediciones: 1,
      edicion: { fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/), usuario: { id_usuario: ctx.vet.id_usuario } },
    });
    const [[edicion]] = await pool.query("SELECT id_usuario, campos, valores_anteriores FROM historial_medico_ediciones WHERE id_historial = ?", [
      ctx.deA.id_historial,
    ]);
    const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);
    expect(edicion.id_usuario).toBe(ctx.vet.id_usuario);
    expect(parse(edicion.campos).sort()).toEqual(["diagnostico", "temperatura", "tipo"]);
    expect(parse(edicion.valores_anteriores)).toMatchObject({ diagnostico: "Otitis", tipo: "consulta_general", temperatura: null });

    const otra = await api(ctx.tokenA).patch(url).send({ indicaciones: "Reposo" });
    expect(otra.body.data).toMatchObject({ ediciones: 2, edicion: { usuario: { id_usuario: ctx.clinicaA.propietario.id_usuario } } });

    // La ficha de otro negocio también ve que se editó, sin las notas internas.
    const enB = await api(ctx.tokenB).get(`/negocios/${ctx.clinicaB.id_negocio}/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(enB.body.data.find((r) => r.id_historial === ctx.deA.id_historial)).toMatchObject({ ediciones: 2, es_propio: false });
  });

  it("crea registros de tipo control", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenA)
      .post(`/negocios/${ctx.clinicaA.id_negocio}/historial`)
      .send({ id_mascota: ctx.mascota.id_mascota, tipo: "control", diagnostico: "Evoluciona bien" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ tipo: "control", edicion: null, ediciones: 0 });
  });

  it("registros_medicos en el detalle de la cita y en las citas de la mascota", async () => {
    const ctx = await contexto();
    const conCita = await api(ctx.tokenA)
      .post(`/negocios/${ctx.clinicaA.id_negocio}/historial`)
      .send({ id_mascota: ctx.mascota.id_mascota, id_cita: ctx.citaA.id_cita, tipo: "consulta_general", fecha: ctx.citaA.fecha });
    const esperado = [{ id_historial: conCita.body.data.id_historial, tipo: "consulta_general", fecha: ctx.citaA.fecha }];

    const detalle = await api(ctx.tokenA).get(`/citas/${ctx.citaA.id_cita}`);
    expect(detalle.body.data.registros_medicos).toEqual(esperado);
    const citas = await api(ctx.tokenA).get(`/negocios/${ctx.clinicaA.id_negocio}/mascotas/${ctx.mascota.id_mascota}/citas`);
    expect(citas.body.data.find((c) => c.id_cita === ctx.citaA.id_cita).registros_medicos).toEqual(esperado);
  });
});

describe("profesional del registro y quién lo creó (026)", () => {
  const crear = (ctx, token, body = {}) =>
    api(token)
      .post(`/negocios/${ctx.clinicaA.id_negocio}/historial`)
      .send({ id_mascota: ctx.mascota.id_mascota, tipo: "consulta_general", diagnostico: "Sano", ...body });

  /** Otra veterinaria de la clínica A (sin cuenta), a cuyo nombre se transcribe. */
  const conOtra = async () => {
    const ctx = await contexto();
    const otra = await crearEmpleado(ctx.clinicaA, { nombre: "Olga" });
    return { ...ctx, otra };
  };

  it("sin asignar_profesional (Veterinario), el registro queda a su nombre; otro profesional da 403", async () => {
    const ctx = await conOtra();
    const ajeno = await crear(ctx, ctx.tokenVet, { id_empleado: ctx.otra.id_empleado });
    expect(ajeno.status).toBe(403);
    expect(ajeno.body.message).toMatch(/asignar profesional/);
    expect((await crear(ctx, ctx.tokenVet, { id_empleado: null })).status).toBe(403);

    for (const body of [{}, { id_empleado: ctx.vet.id_empleado }]) {
      const res = await crear(ctx, ctx.tokenVet, body);
      expect(res.status).toBe(201);
      expect(res.body.data.empleado.id_empleado).toBe(ctx.vet.id_empleado);
      expect(res.body.data.registrado_por).toMatchObject({ id_usuario: ctx.vet.id_usuario });
    }
  });

  it("el propietario, el Administrador y un rol propio con asignar_profesional eligen a otro; queda quién lo creó", async () => {
    const ctx = await conOtra();
    const usuarioAdmin = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario: usuarioAdmin, rol: "Administrador" });
    const usuarioPropio = await crearUsuario();
    const rolPropio = await crearRol(ctx.clinicaA, { historial_medico: ["ver", "crear", "asignar_profesional"] });
    await crearEmpleado(ctx.clinicaA, { usuario: usuarioPropio, rol: rolPropio.id_rol });

    for (const usuario of [ctx.clinicaA.propietario, usuarioAdmin, usuarioPropio]) {
      const res = await crear(ctx, await tokenDe(usuario), { id_empleado: ctx.otra.id_empleado });
      expect(res.status).toBe(201);
      expect(res.body.data.empleado).toMatchObject({ id_empleado: ctx.otra.id_empleado, nombre: "Olga" });
      expect(res.body.data.registrado_por).toEqual({
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
      });
      const [[fila]] = await pool.query("SELECT id_usuario_registro FROM historial_medico WHERE id_historial = ?", [
        res.body.data.id_historial,
      ]);
      expect(fila.id_usuario_registro).toBe(usuario.id_usuario);
    }
  });

  it("al editar, solo quien tiene asignar_profesional cambia el profesional", async () => {
    const ctx = await conOtra();
    const { body } = await crear(ctx, ctx.tokenVet);
    const id = body.data.id_historial;
    const editar = (token, cambios) => api(token).patch(`/historial/${id}`).send(cambios);

    expect((await editar(ctx.tokenVet, { id_empleado: ctx.otra.id_empleado })).status).toBe(403);
    // Enviar el mismo profesional no es un cambio.
    expect((await editar(ctx.tokenVet, { id_empleado: ctx.vet.id_empleado, diagnostico: "Otitis" })).status).toBe(200);
    const res = await editar(ctx.tokenA, { id_empleado: ctx.otra.id_empleado });
    expect(res.status).toBe(200);
    expect(res.body.data.empleado.id_empleado).toBe(ctx.otra.id_empleado);
    // Quién lo creó no cambia al editar.
    expect(res.body.data.registrado_por.id_usuario).toBe(ctx.vet.id_usuario);
  });

  it("registrado_por solo sale en los registros del negocio que consulta, no al dueño ni a otros negocios", async () => {
    const ctx = await contexto();
    await crear(ctx, ctx.tokenVet);
    const propios = await panel(ctx, ctx.clinicaA, ctx.tokenA);
    expect(propios.body.data.find((r) => r.es_propio && r.diagnostico === "Sano")).toHaveProperty("registrado_por");
    // Los registros anteriores a la migración no tienen quién los creó.
    expect(propios.body.data.find((r) => r.id_historial === ctx.deA.id_historial).registrado_por).toBeNull();

    const delDueno = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(delDueno.body.data.every((r) => !("registrado_por" in r))).toBe(true);
    const deB = await panel(ctx, ctx.clinicaB, ctx.tokenB);
    expect(deB.body.data.filter((r) => !r.es_propio).every((r) => !("registrado_por" in r))).toBe(true);
  });
});
