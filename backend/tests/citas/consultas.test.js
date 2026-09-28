import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};
const proximo = (dia) => {
  const fecha = new Date();
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== dia);
  return hoyISO(fecha);
};
const HOY = hoyISO();
const LUNES = proximo(1);

/**
 * Negocio con sucursal ubicada (lunes a sábado 08–18), un empleado con cuenta
 * (Ana), otro sin cuenta (Luis), un servicio y un cliente con dos mascotas.
 */
const contexto = async () => {
  const negocio = await crearNegocio(null, { logo_url: "https://cdn.petcat.test/logo.png" });
  const sucursal = await crearSucursal(negocio, {
    nombre: "Sede Norte",
    direccion: "Cra 25 # 30-10",
    telefono: "6052803030",
    latitud: 9.30472,
    longitud: -75.39778,
  });
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const usuarioAna = await crearUsuario();
  const ana = await crearEmpleado(negocio, { usuario: usuarioAna, rol: "Veterinario", nombre: "Ana" });
  const luis = await crearEmpleado(negocio, { nombre: "Luis" });
  const servicio = await crearServicio(negocio, { nombre: "Consulta" });
  const cliente = await crearUsuario({ nombre: "Rosa", apellido: "Pérez" });
  const max = await crearMascota(cliente, { nombre: "Max" });
  const luna = await crearMascota(cliente, { nombre: "Luna", especie: "gato" });
  return {
    negocio,
    sucursal,
    ana,
    luis,
    servicio,
    cliente,
    max,
    luna,
    tokenAna: await tokenDe(usuarioAna),
    tokenPropietario: await tokenDe(negocio.propietario),
    tokenCliente: await tokenDe(cliente),
  };
};

const cita = (ctx, overrides = {}) =>
  crearCita(ctx.negocio, {
    cliente: ctx.cliente,
    mascota: ctx.max,
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    id_empleado: ctx.ana.id_empleado,
    fecha: LUNES,
    hora_inicio: "09:00:00",
    hora_fin: "09:30:00",
    estado: "confirmada",
    notas_internas: "Paciente nervioso",
    ...overrides,
  });

const ids = (res) => res.body.data.map((c) => c.id_cita);

describe("GET /citas/mias", () => {
  it("próximas por defecto (de la más cercana), solo del usuario, sin notas internas y con dónde es la cita", async () => {
    const ctx = await contexto();
    const lejana = await cita(ctx, { fecha: sumarDias(LUNES, 7) });
    const cercana = await cita(ctx, { fecha: LUNES });
    await cita(ctx, { fecha: sumarDias(HOY, -3) });
    await crearCita(ctx.negocio, { fecha: LUNES });

    const res = await api(ctx.tokenCliente).get("/citas/mias");

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([cercana.id_cita, lejana.id_cita]);
    expect(res.body.meta).toMatchObject({ total: 2, page: 1 });
    const [primera] = res.body.data;
    expect(primera).not.toHaveProperty("notas_internas");
    expect(primera).not.toHaveProperty("fuera_de_disponibilidad");
    expect(primera.negocio).toEqual({
      id_negocio: ctx.negocio.id_negocio,
      nombre: ctx.negocio.nombre,
      logo_url: "https://cdn.petcat.test/logo.png",
    });
    expect(primera.sucursal).toEqual({
      id_sucursal: ctx.sucursal.id_sucursal,
      nombre: "Sede Norte",
      direccion: "Cra 25 # 30-10",
      telefono: "6052803030",
      latitud: 9.30472,
      longitud: -75.39778,
    });
  });

  it("pasadas y todas van de la más reciente hacia atrás; filtra por estado y mascota", async () => {
    const ctx = await contexto();
    const hace3 = await cita(ctx, { fecha: sumarDias(HOY, -3), estado: "completada" });
    const hace10 = await cita(ctx, { fecha: sumarDias(HOY, -10), estado: "cancelada" });
    const futura = await cita(ctx, { mascota: ctx.luna });

    expect(ids(await api(ctx.tokenCliente).get("/citas/mias?alcance=pasadas"))).toEqual([hace3.id_cita, hace10.id_cita]);
    expect(ids(await api(ctx.tokenCliente).get("/citas/mias?alcance=todas"))).toEqual([
      futura.id_cita,
      hace3.id_cita,
      hace10.id_cita,
    ]);
    expect(ids(await api(ctx.tokenCliente).get("/citas/mias?alcance=todas&estado=cancelada,completada"))).toEqual([
      hace3.id_cita,
      hace10.id_cita,
    ]);
    expect(ids(await api(ctx.tokenCliente).get(`/citas/mias?alcance=todas&id_mascota=${ctx.luna.id_mascota}`))).toEqual([
      futura.id_cita,
    ]);
  });

  it("valida los filtros -> 422; sin token -> 401", async () => {
    const ctx = await contexto();
    expect((await api(ctx.tokenCliente).get("/citas/mias?alcance=ayer")).status).toBe(422);
    const estado = await api(ctx.tokenCliente).get("/citas/mias?estado=pendiente,perdida");
    expect(estado.status).toBe(422);
    expect(Object.keys(estado.body.errors)[0]).toMatch(/^estado/);
    expect((await api().get("/citas/mias")).status).toBe(401);
  });
});

describe("GET /negocios/:id_negocio/citas (agenda)", () => {
  const agenda = (ctx, query = "", token = ctx.tokenPropietario) =>
    api(token).get(`/negocios/${ctx.negocio.id_negocio}/citas${query ? `?${query}` : ""}`);

  it("por defecto hoy; con rango, las del negocio por fecha y hora con notas internas", async () => {
    const ctx = await contexto();
    const hoy = await cita(ctx, { fecha: HOY, hora_inicio: "23:00:00", hora_fin: "23:30:00" });
    const tarde = await cita(ctx, { hora_inicio: "15:00:00", hora_fin: "15:30:00" });
    const temprano = await cita(ctx, { hora_inicio: "08:00:00", hora_fin: "08:30:00" });
    await crearCita(await crearNegocio(), { fecha: LUNES });

    const soloHoy = await agenda(ctx);
    expect(ids(soloHoy)).toEqual([hoy.id_cita]);
    expect(soloHoy.body.meta).toEqual({ total: 1, desde: HOY, hasta: HOY });

    const rango = await agenda(ctx, `desde=${HOY}&hasta=${LUNES}`);
    expect(ids(rango)).toEqual([hoy.id_cita, temprano.id_cita, tarde.id_cita]);
    expect(rango.body.data[1]).toMatchObject({
      notas_internas: "Paciente nervioso",
      cliente: { id_usuario: ctx.cliente.id_usuario, nombre: "Rosa" },
      fuera_de_disponibilidad: false,
    });
  });

  it("rango máximo de 31 días; hasta antes de desde -> 422", async () => {
    const ctx = await contexto();
    expect((await agenda(ctx, `desde=${HOY}&hasta=${sumarDias(HOY, 30)}`)).status).toBe(200);
    const largo = await agenda(ctx, `desde=${HOY}&hasta=${sumarDias(HOY, 31)}`);
    expect(largo.status).toBe(422);
    expect(largo.body.errors).toEqual({ hasta: "El rango máximo es de 31 días" });
    expect((await agenda(ctx, `desde=${HOY}&hasta=${sumarDias(HOY, -1)}`)).body.errors).toEqual({
      hasta: "No puede ser anterior a desde",
    });
  });

  it("filtra por estados, empleado, sucursal, servicio y texto (cliente o mascota)", async () => {
    const ctx = await contexto();
    const otraSucursal = await crearSucursal(ctx.negocio);
    const otroServicio = await crearServicio(ctx.negocio);
    const deAna = await cita(ctx);
    const deLuis = await cita(ctx, { id_empleado: ctx.luis.id_empleado, estado: "pendiente", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const deLuna = await cita(ctx, {
      mascota: ctx.luna,
      id_sucursal: otraSucursal.id_sucursal,
      servicio: otroServicio,
      estado: "cancelada",
      hora_inicio: "11:00:00",
      hora_fin: "11:30:00",
    });
    const base = `desde=${LUNES}&hasta=${LUNES}`;

    expect(ids(await agenda(ctx, `${base}&estado=pendiente,cancelada`))).toEqual([deLuis.id_cita, deLuna.id_cita]);
    expect(ids(await agenda(ctx, `${base}&id_empleado=${ctx.luis.id_empleado}`))).toEqual([deLuis.id_cita]);
    expect(ids(await agenda(ctx, `${base}&id_sucursal=${otraSucursal.id_sucursal}`))).toEqual([deLuna.id_cita]);
    expect(ids(await agenda(ctx, `${base}&id_servicio=${ctx.servicio.id_servicio}`))).toEqual([deAna.id_cita, deLuis.id_cita]);
    expect(ids(await agenda(ctx, `${base}&q=luna`))).toEqual([deLuna.id_cita]);
    expect(ids(await agenda(ctx, `${base}&q=${encodeURIComponent("rosa pérez")}`))).toHaveLength(3);
  });

  it("filtros de otro negocio -> 422 sin devolver datos", async () => {
    const ctx = await contexto();
    const otro = await contexto();
    const res = await agenda(
      ctx,
      `id_empleado=${otro.ana.id_empleado}&id_sucursal=${otro.sucursal.id_sucursal}&id_servicio=${otro.servicio.id_servicio}`
    );
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      id_sucursal: "No pertenece a este negocio",
      id_empleado: "No pertenece a este negocio",
      id_servicio: "No pertenece a este negocio",
    });
  });

  it("solo_mias: el empleado ve solo las suyas; sin perfil de empleado -> 422", async () => {
    const ctx = await contexto();
    const deAna = await cita(ctx);
    await cita(ctx, { id_empleado: ctx.luis.id_empleado, hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const base = `desde=${LUNES}&hasta=${LUNES}`;

    expect(ids(await agenda(ctx, `${base}&solo_mias=true`, ctx.tokenAna))).toEqual([deAna.id_cita]);
    expect(ids(await agenda(ctx, base, ctx.tokenAna))).toHaveLength(2);

    const sinPerfil = await agenda(ctx, `${base}&solo_mias=true`);
    expect(sinPerfil.status).toBe(422);
    expect(sinPerfil.body.errors).toEqual({ solo_mias: "No tienes un perfil de empleado activo en este negocio" });

    const mezcla = await agenda(ctx, `${base}&solo_mias=true&id_empleado=${ctx.luis.id_empleado}`, ctx.tokenAna);
    expect(mezcla.body.errors).toEqual({ id_empleado: "No se combina con solo_mias" });
  });

  it("solo_mias funciona para el propietario registrado como empleado", async () => {
    const ctx = await contexto();
    const propio = await crearEmpleado(ctx.negocio, { usuario: ctx.negocio.propietario, rol: "Administrador" });
    const suya = await cita(ctx, { id_empleado: propio.id_empleado });
    await cita(ctx, { hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    expect(ids(await agenda(ctx, `desde=${LUNES}&hasta=${LUNES}&solo_mias=true`))).toEqual([suya.id_cita]);
  });

  it("marca fuera_de_disponibilidad (solo futuras pendientes o confirmadas) y permite filtrarlas", async () => {
    const ctx = await contexto();
    const enVacaciones = await cita(ctx);
    const cancelada = await cita(ctx, { estado: "cancelada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const deLuis = await cita(ctx, { id_empleado: ctx.luis.id_empleado, hora_inicio: "11:00:00", hora_fin: "11:30:00" });
    await pool.query(
      "INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica) VALUES (?, 'vacacion', ?)",
      [ctx.ana.id_empleado, LUNES]
    );
    const base = `desde=${LUNES}&hasta=${LUNES}`;

    const todas = await agenda(ctx, base);
    const marca = Object.fromEntries(todas.body.data.map((c) => [c.id_cita, c.fuera_de_disponibilidad]));
    expect(marca).toEqual({ [enVacaciones.id_cita]: true, [cancelada.id_cita]: false, [deLuis.id_cita]: false });

    expect(ids(await agenda(ctx, `${base}&fuera_de_disponibilidad=true`))).toEqual([enVacaciones.id_cita]);
    expect(ids(await agenda(ctx, `${base}&fuera_de_disponibilidad=false`))).toEqual([cancelada.id_cita, deLuis.id_cita]);
  });

  it("requiere citas.ver del negocio: rol sin citas.ver o personal de otro negocio -> 403", async () => {
    const ctx = await contexto();
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { inventario: ["ver"] })).id_rol });
    expect((await agenda(ctx, "", await tokenDe(usuario))).status).toBe(403);
    const otro = await contexto();
    expect((await agenda(ctx, "", otro.tokenPropietario)).status).toBe(403);
    expect((await agenda(ctx, "", ctx.tokenCliente)).status).toBe(403);
  });
});

describe("GET /citas/:id_cita", () => {
  it("el dueño recibe la cita sin notas internas, con dónde es la cita", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    const res = await api(ctx.tokenCliente).get(`/citas/${c.id_cita}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id_cita: c.id_cita,
      negocio: { id_negocio: ctx.negocio.id_negocio, logo_url: "https://cdn.petcat.test/logo.png" },
      sucursal: { id_sucursal: ctx.sucursal.id_sucursal, telefono: "6052803030", latitud: 9.30472, longitud: -75.39778 },
    });
    expect(res.body.data).not.toHaveProperty("notas_internas");
    expect(res.body.data).not.toHaveProperty("fuera_de_disponibilidad");
  });

  it("el personal del negocio recibe la vista completa", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    for (const token of [ctx.tokenPropietario, ctx.tokenAna]) {
      const res = await api(token).get(`/citas/${c.id_cita}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ notas_internas: "Paciente nervioso", fuera_de_disponibilidad: false });
    }
  });

  it("otro usuario o el personal de otro negocio -> 403; inexistente -> 404", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    const otro = await contexto();
    for (const token of [otro.tokenCliente, otro.tokenPropietario, otro.tokenAna]) {
      const res = await api(token).get(`/citas/${c.id_cita}`);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain("Paciente nervioso");
    }
    expect((await api(ctx.tokenCliente).get("/citas/999999999")).status).toBe(404);
  });
});
