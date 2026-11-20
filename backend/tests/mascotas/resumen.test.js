import { afterEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearHistorial,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearUsuario,
  crearVacuna,
  tokenDe,
} from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (dias) => {
  const fecha = new Date(`${HOY}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

afterEach(() => vi.restoreAllMocks());

/**
 * Dueño con tres mascotas:
 * - Max: antirrábica vigente que vence en 10 días (con una dosis anterior que ya no cuenta),
 *   parvovirus vencido hace 3 días y una cita en la Clínica A dentro de 5 días.
 * - Luna: sin vacunas; desparasitación en 4 días (Clínica B), control en 20 y otro en 90
 *   (fuera de la ventana); citas en B (mañana) y en A (en 3 días): la próxima es la de B.
 * - Copito: fallecido, con una vacuna vencida.
 */
const escenario = async () => {
  const dueno = await crearUsuario();
  const clinicaA = await crearNegocio(null, { nombre: "Clínica A" });
  const clinicaB = await crearNegocio(null, { nombre: "Clínica B" });
  const max = await crearMascota(dueno, { nombre: "Max" });
  const luna = await crearMascota(dueno, { nombre: "Luna", especie: "gato" });
  const copito = await crearMascota(dueno, { nombre: "Copito", fallecido: true, fecha_fallecimiento: HOY });

  await crearVacuna(max, { nombre_vacuna: "Antirrábica", fecha_aplicacion: sumarDias(-400), fecha_proxima: sumarDias(-35) });
  const rabia = await crearVacuna(max, {
    nombre_vacuna: "Antirrábica",
    fecha_aplicacion: sumarDias(-355),
    fecha_proxima: sumarDias(10),
  });
  const parvo = await crearVacuna(max, {
    nombre_vacuna: "Parvovirus",
    fecha_aplicacion: sumarDias(-200),
    fecha_proxima: sumarDias(-3),
  });
  await crearVacuna(copito, { nombre_vacuna: "Triple felina", fecha_aplicacion: sumarDias(-400), fecha_proxima: sumarDias(-30) });

  const desparasitacion = await crearHistorial(clinicaB, luna, {
    tipo: "desparasitacion",
    fecha: sumarDias(-86),
    proximo_control: sumarDias(4),
  });
  const control = await crearHistorial(clinicaA, luna, { tipo: "control", fecha: sumarDias(-10), proximo_control: sumarDias(20) });
  await crearHistorial(clinicaA, luna, { tipo: "control", fecha: sumarDias(-5), proximo_control: sumarDias(90) });

  const servicioA = await crearServicio(clinicaA, { nombre: "Consulta general" });
  const servicioB = await crearServicio(clinicaB, { nombre: "Baño" });
  const citaMax = await crearCita(clinicaA, { cliente: dueno, mascota: max, servicio: servicioA, fecha: sumarDias(5), estado: "confirmada" });
  const citaLuna = await crearCita(clinicaB, { cliente: dueno, mascota: luna, servicio: servicioB, fecha: sumarDias(1), estado: "pendiente" });
  await crearCita(clinicaA, { cliente: dueno, mascota: luna, servicio: servicioA, fecha: sumarDias(3), estado: "confirmada" });
  await crearCita(clinicaA, { cliente: dueno, mascota: luna, servicio: servicioA, fecha: sumarDias(-2), estado: "completada" });

  return {
    dueno,
    clinicaA,
    clinicaB,
    max,
    luna,
    copito,
    rabia,
    parvo,
    desparasitacion,
    control,
    citaMax,
    citaLuna,
    token: await tokenDe(dueno),
  };
};

const porNombre = (lista) => Object.fromEntries(lista.map((m) => [m.nombre, m]));

describe("GET /mascotas?incluir=resumen", () => {
  it("sin incluir no trae resumen (el panel y lo existente no cambian)", async () => {
    const { token } = await escenario();
    const res = await api(token).get("/mascotas");
    expect(res.status).toBe(200);
    for (const mascota of res.body.data) expect(mascota).not.toHaveProperty("resumen");
  });

  it("calcula vacunas, próximos eventos y próxima cita de cada mascota", async () => {
    const e = await escenario();
    const res = await api(e.token).get("/mascotas?incluir=resumen");
    expect(res.status).toBe(200);
    const { Max, Luna, Copito } = porNombre(res.body.data);

    expect(Max.resumen).toEqual({
      estado_vacunas: "vencido",
      // La dosis anterior de antirrábica no cuenta (no_aplica).
      vacunas: { vigentes: 2, al_dia: 0, proximas: 1, vencidas: 1 },
      proximos_eventos: [
        { tipo: "vacuna", titulo: "Parvovirus", fecha: sumarDias(-3), dias: -3, id_vacuna: e.parvo.id_vacuna, id_historial: null, negocio: null },
        { tipo: "vacuna", titulo: "Antirrábica", fecha: sumarDias(10), dias: 10, id_vacuna: e.rabia.id_vacuna, id_historial: null, negocio: null },
      ],
      proxima_cita: {
        id_cita: e.citaMax.id_cita,
        fecha: sumarDias(5),
        hora_inicio: "09:00",
        estado: "confirmada",
        servicio: { id_servicio: e.citaMax.id_servicio, nombre: "Consulta general" },
        negocio: { id_negocio: e.clinicaA.id_negocio, nombre: "Clínica A" },
      },
    });

    expect(Luna.resumen.estado_vacunas).toBe("sin_vacunas");
    expect(Luna.resumen.vacunas).toEqual({ vigentes: 0, al_dia: 0, proximas: 0, vencidas: 0 });
    // El control a 90 días queda fuera de la ventana (dias_aviso_vacuna = 30).
    expect(Luna.resumen.proximos_eventos).toEqual([
      {
        tipo: "desparasitacion",
        titulo: "Desparasitación",
        fecha: sumarDias(4),
        dias: 4,
        id_vacuna: null,
        id_historial: e.desparasitacion.id_historial,
        negocio: { id_negocio: e.clinicaB.id_negocio, nombre: "Clínica B" },
      },
      {
        tipo: "control",
        titulo: "Control",
        fecha: sumarDias(20),
        dias: 20,
        id_vacuna: null,
        id_historial: e.control.id_historial,
        negocio: { id_negocio: e.clinicaA.id_negocio, nombre: "Clínica A" },
      },
    ]);
    // La más cercana, de cualquier negocio (la de B, mañana).
    expect(Luna.resumen.proxima_cita).toMatchObject({ id_cita: e.citaLuna.id_cita, estado: "pendiente" });

    // Fallecido: sin estado de vacunas, eventos ni cita.
    expect(Copito.resumen).toEqual({
      estado_vacunas: null,
      vacunas: { vigentes: 1, al_dia: 0, proximas: 0, vencidas: 1 },
      proximos_eventos: [],
      proxima_cita: null,
    });
  });

  it("GET /mascotas/:id_mascota?incluir=resumen trae el mismo resumen; incluir inválido -> 422", async () => {
    const e = await escenario();
    const lista = porNombre((await api(e.token).get("/mascotas?incluir=resumen")).body.data);
    const una = await api(e.token).get(`/mascotas/${e.luna.id_mascota}?incluir=resumen`);
    expect(una.status).toBe(200);
    expect(una.body.data.resumen).toEqual(lista.Luna.resumen);
    expect((await api(e.token).get(`/mascotas/${e.luna.id_mascota}`)).body.data).not.toHaveProperty("resumen");

    const invalido = await api(e.token).get("/mascotas?incluir=todo");
    expect(invalido.status).toBe(422);
    expect(invalido.body.errors).toHaveProperty("incluir");
  });

  it("se calcula en lote: el mismo número de consultas con 1 mascota que con 6", async () => {
    const contarConsultas = async (cuantas) => {
      const dueno = await crearUsuario();
      const negocio = await crearNegocio(null);
      for (let i = 0; i < cuantas; i++) {
        const mascota = await crearMascota(dueno);
        await crearVacuna(mascota, { fecha_proxima: sumarDias(5) });
        await crearHistorial(negocio, mascota, { proximo_control: sumarDias(7) });
        await crearCita(negocio, { cliente: dueno, mascota, fecha: sumarDias(2), estado: "confirmada" });
      }
      const token = await tokenDe(dueno);
      const espia = vi.spyOn(pool, "query");
      const res = await api(token).get("/mascotas?incluir=resumen");
      const consultas = espia.mock.calls.length;
      espia.mockRestore();
      expect(res.body.data).toHaveLength(cuantas);
      return consultas;
    };
    expect(await contarConsultas(6)).toBe(await contarConsultas(1));
  });

  it("sin mascotas, lista vacía", async () => {
    const res = await api(await tokenDe(await crearUsuario())).get("/mascotas?incluir=resumen");
    expect(res.body).toMatchObject({ success: true, data: [] });
  });
});

describe("el resumen es solo del dueño", () => {
  it("un negocio con cita no puede pedirlo: 403 en la mascota, y su lista solo tiene sus propias mascotas", async () => {
    const e = await escenario();
    const tokenB = await tokenDe(e.clinicaB.propietario);

    const ajena = await api(tokenB).get(`/mascotas/${e.luna.id_mascota}?incluir=resumen`);
    expect(ajena.status).toBe(403);
    expect(ajena.body).not.toHaveProperty("data");

    const propias = await api(tokenB).get("/mascotas?incluir=resumen");
    expect(propias.status).toBe(200);
    expect(propias.body.data).toEqual([]);
  });

  it("las rutas del panel no aceptan incluir ni traen el resumen (no ve citas de otros negocios)", async () => {
    const e = await escenario();
    const tokenB = await tokenDe(e.clinicaB.propietario);

    const cliente = await api(tokenB).get(`/negocios/${e.clinicaB.id_negocio}/clientes/${e.dueno.id_usuario}?incluir=resumen`);
    expect(cliente.status).toBe(200);
    const texto = JSON.stringify(cliente.body);
    expect(texto).not.toContain('"resumen"');
    expect(texto).not.toContain("Clínica A");

    // El resumen de salud del panel (ya existente) sigue limitado a lo del negocio.
    const salud = await api(tokenB).get(`/negocios/${e.clinicaB.id_negocio}/mascotas/${e.luna.id_mascota}/resumen-salud`);
    expect(salud.status).toBe(200);
    expect(salud.body.data.proxima_cita).toMatchObject({ negocio: { id_negocio: e.clinicaB.id_negocio } });
  });
});
