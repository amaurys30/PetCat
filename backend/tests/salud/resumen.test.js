import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { evolucionPeso } from "../../src/modules/salud/salud.service.js";
import { api } from "../helpers/api.js";
import { crearCita, crearHistorial, crearMascota, crearNegocio, crearUsuario, crearVacuna, tokenDe } from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

const contexto = async (extraMascota = {}) => {
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente, {
    peso: 11,
    tiene_alergias: true,
    alergias_detalle: "Penicilina",
    condiciones_medicas: "Soplo leve",
    ...extraMascota,
  });
  const clinicaA = await crearNegocio(null, { nombre: "Clínica A" });
  const clinicaB = await crearNegocio(null, { nombre: "Clínica B" });
  await crearCita(clinicaA, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -40) });
  await crearCita(clinicaB, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -50) });
  return {
    cliente,
    mascota,
    clinicaA,
    clinicaB,
    tokenCliente: await tokenDe(cliente),
    tokenA: await tokenDe(clinicaA.propietario),
  };
};

const resumenDueno = async (ctx) => (await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/resumen-salud`)).body.data;
const resumenA = (ctx) => api(ctx.tokenA).get(`/negocios/${ctx.clinicaA.id_negocio}/mascotas/${ctx.mascota.id_mascota}/resumen-salud`);

describe("GET /mascotas/:id_mascota/resumen-salud", () => {
  it("vacunas vencidas (con días de atraso) y próximas en 30 días; las dosis reemplazadas no alertan", async () => {
    const ctx = await contexto();
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Rabia", fecha_aplicacion: sumarDias(HOY, -400), fecha_proxima: sumarDias(HOY, -10) });
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Moquillo", fecha_aplicacion: sumarDias(HOY, -350), fecha_proxima: sumarDias(HOY, 12) });
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Lepto", fecha_aplicacion: sumarDias(HOY, -300), fecha_proxima: sumarDias(HOY, 60) });
    // Una dosis vieja de parvovirus vencida, reemplazada por una nueva al día.
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Parvovirus", fecha_aplicacion: sumarDias(HOY, -500), fecha_proxima: sumarDias(HOY, -100) });
    await crearVacuna(ctx.mascota, { nombre_vacuna: "parvovirus", fecha_aplicacion: sumarDias(HOY, -20), fecha_proxima: sumarDias(HOY, 345) });

    const r = await resumenDueno(ctx);

    expect(r.vacunas_vencidas).toEqual([expect.objectContaining({ nombre_vacuna: "Rabia", dias_vencida: 10, registrada_por: "dueno" })]);
    expect(r.vacunas_proximas).toEqual([expect.objectContaining({ nombre_vacuna: "Moquillo", dias_restantes: 12 })]);
  });

  it("último control del historial, próximo control indicado y próxima cita", async () => {
    const ctx = await contexto();
    await crearHistorial(ctx.clinicaB, ctx.mascota, { fecha: sumarDias(HOY, -50), proximo_control: sumarDias(HOY, 90) });
    await crearHistorial(ctx.clinicaA, ctx.mascota, {
      fecha: sumarDias(HOY, -40),
      diagnostico: "Control anual",
      proximo_control: sumarDias(HOY, 20),
    });
    await crearHistorial(ctx.clinicaA, ctx.mascota, { fecha: sumarDias(HOY, -60), proximo_control: sumarDias(HOY, -5) });
    const proxima = await crearCita(ctx.clinicaB, {
      cliente: ctx.cliente,
      mascota: ctx.mascota,
      estado: "confirmada",
      fecha: sumarDias(HOY, 3),
    });
    await crearCita(ctx.clinicaA, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada", fecha: sumarDias(HOY, 1) });

    const r = await resumenDueno(ctx);

    expect(r.ultimo_control).toMatchObject({ fuente: "historial", fecha: sumarDias(HOY, -40), diagnostico: "Control anual", negocio: { nombre: "Clínica A" } });
    expect(r.proximo_control).toMatchObject({ fecha: sumarDias(HOY, 20), negocio: { nombre: "Clínica A" } });
    expect(r.proxima_cita).toMatchObject({ id_cita: proxima.id_cita, fecha: sumarDias(HOY, 3), negocio: { nombre: "Clínica B" } });
  });

  it("sin historial, el último control es la última cita completada", async () => {
    const ctx = await contexto();
    const r = await resumenDueno(ctx);
    expect(r.ultimo_control).toMatchObject({ fuente: "cita", fecha: sumarDias(HOY, -40), negocio: { nombre: "Clínica A" } });
    expect(r.proximo_control).toBeNull();
    expect(r.proxima_cita).toBeNull();
  });

  it("evolución del peso con variación y tendencia; los datos de la mascota incluyen alergias", async () => {
    const ctx = await contexto();
    await crearHistorial(ctx.clinicaA, ctx.mascota, { fecha: sumarDias(HOY, -120), peso_registro: 10 });
    await crearHistorial(ctx.clinicaA, ctx.mascota, { fecha: sumarDias(HOY, -30), peso_registro: 11 });
    await crearHistorial(ctx.clinicaA, ctx.mascota, { fecha: sumarDias(HOY, -900), peso_registro: 5 });

    const r = await resumenDueno(ctx);

    expect(r.evolucion_peso).toEqual({
      peso_actual: 11,
      puntos: [
        { fecha: sumarDias(HOY, -120), peso: 10 },
        { fecha: sumarDias(HOY, -30), peso: 11 },
      ],
      variacion_kg: 1,
      variacion_pct: 10,
      tendencia: "sube",
    });
    expect(r.mascota).toMatchObject({ tiene_alergias: true, alergias_detalle: "Penicilina", condiciones_medicas: "Soplo leve" });
  });

  it("una mascota fallecida no trae alertas de vacunas ni próxima cita", async () => {
    const ctx = await contexto({ fallecido: true, fecha_fallecimiento: HOY });
    await crearVacuna(ctx.mascota, { fecha_aplicacion: sumarDias(HOY, -400), fecha_proxima: sumarDias(HOY, -10) });
    const r = await resumenDueno(ctx);
    expect(r).toMatchObject({ vacunas_vencidas: [], vacunas_proximas: [], proxima_cita: null, mascota: { fallecido: true } });
  });
});

describe("GET /negocios/:id_negocio/mascotas/:id_mascota/resumen-salud", () => {
  it("sin compartir: el historial de otros negocios no cuenta, pero las vacunas y las alergias sí", async () => {
    const ctx = await contexto();
    await crearHistorial(ctx.clinicaB, ctx.mascota, { fecha: sumarDias(HOY, -5), diagnostico: "De B", peso_registro: 14 });
    await crearHistorial(ctx.clinicaA, ctx.mascota, { fecha: sumarDias(HOY, -40), diagnostico: "De A" });
    await crearVacuna(ctx.mascota, { nombre_vacuna: "Rabia", id_negocio: ctx.clinicaB.id_negocio, fecha_proxima: sumarDias(HOY, -1) });
    await crearCita(ctx.clinicaB, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "confirmada", fecha: sumarDias(HOY, 2) });
    await pool.query("UPDATE mascotas SET compartir_historial = FALSE WHERE id_mascota = ?", [ctx.mascota.id_mascota]);

    const res = await resumenA(ctx);

    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.ultimo_control).toMatchObject({ diagnostico: "De A" });
    expect(r.evolucion_peso.puntos).toEqual([]);
    expect(r.vacunas_vencidas).toEqual([expect.objectContaining({ nombre_vacuna: "Rabia", registrada_por: "negocio" })]);
    expect(r.proxima_cita).toBeNull();
    expect(r.mascota.alergias_detalle).toBe("Penicilina");
    expect(JSON.stringify(r)).not.toContain("De B");
  });

  it("sin cita válida -> 403", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    const res = await api(await tokenDe(otro.propietario)).get(
      `/negocios/${otro.id_negocio}/mascotas/${ctx.mascota.id_mascota}/resumen-salud`
    );
    expect(res.status).toBe(403);
  });
});

describe("evolucionPeso", () => {
  it("cambios menores al 5 % son estables; con un solo punto no hay tendencia", () => {
    const hoy = "2026-10-01";
    const r = (p, fecha) => ({ peso_registro: p, fecha });
    expect(evolucionPeso([r(20, "2026-09-01"), r(20.5, "2026-09-20")], 20.5, hoy)).toMatchObject({ tendencia: "estable", variacion_pct: 2.5 });
    expect(evolucionPeso([r(20, "2026-09-01"), r(18, "2026-09-20")], 18, hoy)).toMatchObject({ tendencia: "baja", variacion_kg: -2 });
    expect(evolucionPeso([r(20, "2026-09-01")], 20, hoy)).toMatchObject({ tendencia: null, variacion_kg: null });
  });
});

describe("resumen-salud del panel: cabecera de la ficha", () => {
  it("trae la mascota completa (con compartir_historial) y el dueño", async () => {
    const ctx = await contexto({ sexo: "macho", microchip: "985000000000421", compartir_historial: false, raza: "Labrador" });
    const res = await resumenA(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data.mascota).toMatchObject({
      id_mascota: ctx.mascota.id_mascota,
      id_usuario: ctx.cliente.id_usuario,
      raza: "Labrador",
      sexo: "macho",
      microchip: "985000000000421",
      compartir_historial: false,
      esterilizado: false,
      foto_miniatura_url: null,
    });
    expect(res.body.data.mascota).not.toHaveProperty("activo");
    expect(res.body.data.dueno).toEqual({
      id_usuario: ctx.cliente.id_usuario,
      nombre: ctx.cliente.nombre,
      apellido: ctx.cliente.apellido,
    });
  });
});
