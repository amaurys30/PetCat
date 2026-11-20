import { describe, expect, it } from "vitest";
import { estadoApertura, momento } from "../../src/modules/busqueda/apertura.js";
import { buscarNegocios } from "../../src/modules/busqueda/busqueda.service.js";
import { api } from "../helpers/api.js";
import { crearHorarios, crearNegocio, crearSucursal, unique } from "../helpers/factories.js";

// Explorar (app M4): coordenadas de la sucursal cercana para el mapa, si está abierta ahora,
// el filtro abierto_ahora y tipo con varios valores.

const KM_EN_GRADOS_LAT = 1 / 111.195;
const origenUnico = () => ({ lat: -35 - Math.random() * 10, lng: 60 + Math.random() * 30 });
const alNorte = (origen, km) => ({ latitud: origen.lat + km * KM_EN_GRADOS_LAT, longitud: origen.lng });
const buscar = (query) => api().get(`/negocios?${new URLSearchParams(query)}`);

const HOY = momento().dia_semana;
const OTRO_DIA = (HOY + 3) % 7;
/** Todo el día de hoy: abierta sin importar la hora a la que corra la prueba. */
const TODO_HOY = [[HOY, "00:00", "23:59:59"]];

describe("estadoApertura (hora de Bogotá, rangos de hoy)", () => {
  const partido = [
    { hora_apertura: "14:00:00", hora_cierre: "18:00:00" },
    { hora_apertura: "08:00:00", hora_cierre: "12:00:00" },
  ];

  it.each([
    ["07:59:59", { abierto_ahora: false, cierra_a: null, abre_hoy_a: "08:00" }],
    ["08:00:00", { abierto_ahora: true, cierra_a: "12:00", abre_hoy_a: null }],
    ["11:59:59", { abierto_ahora: true, cierra_a: "12:00", abre_hoy_a: null }],
    // La hora de cierre ya es cerrado.
    ["12:00:00", { abierto_ahora: false, cierra_a: null, abre_hoy_a: "14:00" }],
    ["15:30:00", { abierto_ahora: true, cierra_a: "18:00", abre_hoy_a: null }],
    ["18:00:00", { abierto_ahora: false, cierra_a: null, abre_hoy_a: null }],
  ])("horario partido 8-12 y 14-18, a las %s", (hora, esperado) => {
    expect(estadoApertura(partido, hora)).toEqual(esperado);
  });

  it("rangos que se tocan o se solapan son un solo tramo (cierra al final del último)", () => {
    const rangos = [
      { hora_apertura: "08:00", hora_cierre: "12:00" },
      { hora_apertura: "12:00", hora_cierre: "15:00" },
      { hora_apertura: "14:30", hora_cierre: "19:00" },
    ];
    expect(estadoApertura(rangos, "10:00:00")).toEqual({ abierto_ahora: true, cierra_a: "19:00", abre_hoy_a: null });
  });

  it("sin horario hoy: cerrada", () => {
    expect(estadoApertura([], "10:00:00")).toEqual({ abierto_ahora: false, cierra_a: null, abre_hoy_a: null });
  });

  it("momento: día de la semana y hora en la zona del proceso (Bogotá)", () => {
    // Miércoles 18 de noviembre de 2026, 7:05:09 p. m.
    expect(momento(new Date(2026, 10, 18, 19, 5, 9))).toEqual({ dia_semana: 3, hora: "19:05:09" });
  });
});

describe("GET /negocios para Explorar", () => {
  it("la sucursal cercana trae sus coordenadas (o las del negocio si no tiene) para el pin", async () => {
    const origen = origenUnico();
    const marca = unique();
    const conSucursal = await crearNegocio(null, { nombre: `E ${marca} sucursal` });
    const sede = await crearSucursal(conSucursal, alNorte(origen, 1));
    const coordenadasNegocio = alNorte(origen, 2);
    const soloNegocio = await crearNegocio(null, { nombre: `E ${marca} negocio`, ...coordenadasNegocio });
    await crearSucursal(soloNegocio, { es_principal: true });

    const res = await buscar({ ...origen, q: marca });

    const porId = Object.fromEntries(res.body.data.map((n) => [n.id_negocio, n.sucursal_cercana]));
    expect(porId[conSucursal.id_negocio]).toMatchObject({
      id_sucursal: sede.id_sucursal,
      latitud: Number(sede.latitud),
      longitud: Number(sede.longitud),
    });
    expect(porId[soloNegocio.id_negocio].latitud).toBeCloseTo(coordenadasNegocio.latitud, 5);
    expect(porId[soloNegocio.id_negocio].longitud).toBeCloseTo(coordenadasNegocio.longitud, 5);
  });

  it("dice si la sucursal cercana está abierta ahora", async () => {
    const origen = origenUnico();
    const marca = unique();
    const abierto = await crearNegocio(null, { nombre: `E ${marca} abierto` });
    await crearHorarios(await crearSucursal(abierto, alNorte(origen, 1)), TODO_HOY);
    const cerrado = await crearNegocio(null, { nombre: `E ${marca} cerrado` });
    await crearHorarios(await crearSucursal(cerrado, alNorte(origen, 2)), [[OTRO_DIA, "08:00", "18:00"]]);

    const res = await buscar({ ...origen, q: marca });

    const porId = Object.fromEntries(res.body.data.map((n) => [n.id_negocio, n.sucursal_cercana]));
    expect(porId[abierto.id_negocio]).toMatchObject({ abierto_ahora: true, cierra_a: "23:59", abre_hoy_a: null });
    expect(porId[cerrado.id_negocio]).toMatchObject({ abierto_ahora: false, cierra_a: null, abre_hoy_a: null });
  });

  it("a una hora fija: horario partido, abre más tarde hoy", async () => {
    const origen = origenUnico();
    const marca = unique();
    const negocio = await crearNegocio(null, { nombre: `E ${marca}` });
    // Miércoles (3): 8-12 y 14-18.
    await crearHorarios(await crearSucursal(negocio, alNorte(origen, 1)), [
      [3, "08:00", "12:00"],
      [3, "14:00", "18:00"],
    ]);
    const base = { page: 1, limit: 20, ...origen, q: marca };

    const almuerzo = await buscarNegocios(base, new Date(2026, 10, 18, 12, 30));
    expect(almuerzo.rows[0].sucursal_cercana).toMatchObject({ abierto_ahora: false, abre_hoy_a: "14:00" });
    const tarde = await buscarNegocios(base, new Date(2026, 10, 18, 15, 0));
    expect(tarde.rows[0].sucursal_cercana).toMatchObject({ abierto_ahora: true, cierra_a: "18:00" });
    // Con el filtro: a las 12:30 no aparece; a las 15:00 sí.
    expect((await buscarNegocios({ ...base, abierto_ahora: true }, new Date(2026, 10, 18, 12, 30))).rows).toEqual([]);
    expect((await buscarNegocios({ ...base, abierto_ahora: true }, new Date(2026, 10, 18, 15, 0))).rows).toHaveLength(1);
  });

  it("abierto_ahora=true: con coordenadas cuenta la sucursal más cercana; sin ellas, alguna sucursal", async () => {
    const origen = origenUnico();
    const marca = unique();
    const abierto = await crearNegocio(null, { nombre: `E ${marca} abierto` });
    await crearHorarios(await crearSucursal(abierto, alNorte(origen, 1)), TODO_HOY);
    // La más cercana está cerrada; otra más lejos, abierta.
    const cercanaCerrada = await crearNegocio(null, { nombre: `E ${marca} cercana cerrada` });
    await crearHorarios(await crearSucursal(cercanaCerrada, alNorte(origen, 2)), [[OTRO_DIA, "08:00", "18:00"]]);
    await crearHorarios(await crearSucursal(cercanaCerrada, alNorte(origen, 6)), TODO_HOY);
    const sinHorario = await crearNegocio(null, { nombre: `E ${marca} sin horario` });
    await crearSucursal(sinHorario, alNorte(origen, 3));

    const conGeo = await buscar({ ...origen, q: marca, abierto_ahora: "true" });
    expect(conGeo.status).toBe(200);
    expect(conGeo.body.data.map((n) => n.id_negocio)).toEqual([abierto.id_negocio]);
    expect(conGeo.body.meta.total).toBe(1);

    const sinGeo = await buscar({ q: marca, abierto_ahora: "true" });
    expect(sinGeo.body.data.map((n) => n.id_negocio).sort()).toEqual(
      [abierto.id_negocio, cercanaCerrada.id_negocio].sort()
    );

    const todos = await buscar({ ...origen, q: marca, abierto_ahora: "false" });
    expect(todos.body.meta.total).toBe(3);
  });

  it("tipo acepta varios separados por comas (Veterinarias = veterinaria,clinica)", async () => {
    const marca = unique();
    const veterinaria = await crearNegocio(null, { nombre: `E ${marca} vet`, tipo: "veterinaria" });
    const clinica = await crearNegocio(null, { nombre: `E ${marca} clínica`, tipo: "clinica" });
    const peluqueria = await crearNegocio(null, { nombre: `E ${marca} pelu`, tipo: "peluqueria_canina" });
    for (const n of [veterinaria, clinica, peluqueria]) await crearSucursal(n);

    const res = await buscar({ q: marca, tipo: "veterinaria, clinica" });
    expect(res.body.data.map((n) => n.id_negocio).sort()).toEqual([veterinaria.id_negocio, clinica.id_negocio].sort());
    expect((await buscar({ q: marca, tipo: "peluqueria_canina" })).body.data.map((n) => n.id_negocio)).toEqual([
      peluqueria.id_negocio,
    ]);

    expect((await buscar({ tipo: "veterinaria,zoologico" })).status).toBe(422);
    expect((await buscar({ tipo: "" })).status).toBe(422);
    expect((await buscar({ abierto_ahora: "si" })).status).toBe(422);
  });
});
