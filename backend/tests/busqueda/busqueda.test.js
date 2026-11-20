import { describe, expect, it } from "vitest";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  categoriaServicio,
  crearEmpleado,
  crearNegocio,
  crearServicio,
  crearSucursal,
  unique,
} from "../helpers/factories.js";

const KM_EN_GRADOS_LAT = 1 / 111.195;

const diaRelativo = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/** Origen propio para cada test, en una zona sin otros negocios (océano Índico sur). */
const origenUnico = () => ({ lat: -35 - Math.random() * 10, lng: 60 + Math.random() * 30 });

/** Punto a `km` al norte del origen. */
const alNorte = (origen, km) => ({ latitud: origen.lat + km * KM_EN_GRADOS_LAT, longitud: origen.lng });

/** Negocio activo con una sucursal activa (sin coordenadas salvo que se pasen). */
const negocioConSucursal = async (overrides = {}, sucursal = {}) => {
  const negocio = await crearNegocio(null, overrides);
  await crearSucursal(negocio, sucursal);
  return negocio;
};

const buscar = (ruta, query) => api().get(`${ruta}?${new URLSearchParams(query)}`);

describe("GET /negocios (búsqueda pública)", () => {
  it("solo negocios activos con sucursal activa; destacados primero y luego por calificación", async () => {
    const marca = unique();
    const alto = await negocioConSucursal({ nombre: `Vet ${marca} alta`, calificacion_promedio: 4.8 });
    const bajo = await negocioConSucursal({ nombre: `Vet ${marca} baja`, calificacion_promedio: 3.1 });
    const destacado = await negocioConSucursal({ nombre: `Vet ${marca} destacada`, destacado: true, calificacion_promedio: 2 });
    await negocioConSucursal({ nombre: `Vet ${marca} inactiva`, activo: false });
    await crearNegocio(null, { nombre: `Vet ${marca} sin sucursal` });
    const sucursalInactiva = await crearNegocio(null, { nombre: `Vet ${marca} sucursal inactiva` });
    await crearSucursal(sucursalInactiva, { activo: false });

    const res = await buscar("/negocios", { q: marca });

    expect(res.status).toBe(200);
    expect(res.body.data.map((n) => n.id_negocio)).toEqual([destacado.id_negocio, alto.id_negocio, bajo.id_negocio]);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data[1]).toMatchObject({
      nombre: `Vet ${marca} alta`,
      tipo: "veterinaria",
      calificacion_promedio: 4.8,
      verificado: false,
      destacado: false,
      confirmacion_automatica: false,
      distancia_km: null,
      sucursal_cercana: null,
    });
    expect(res.body.data[1]).not.toHaveProperty("nit");
    expect(res.body.data[1]).not.toHaveProperty("id_usuario_propietario");
  });

  it("filtra por tipo y por categoría de sus servicios visibles", async () => {
    const marca = unique();
    const vet = await negocioConSucursal({ nombre: `N ${marca} vet`, tipo: "veterinaria" });
    const pelu = await negocioConSucursal({ nombre: `N ${marca} pelu`, tipo: "peluqueria_canina" });
    const bano = await categoriaServicio("Baño y estética");
    await crearServicio(pelu, { id_categoria: bano });
    await crearServicio(vet, { id_categoria: bano, visible_app: false });

    const porTipo = await buscar("/negocios", { q: marca, tipo: "peluqueria_canina" });
    expect(porTipo.body.data.map((n) => n.id_negocio)).toEqual([pelu.id_negocio]);

    const porCategoria = await buscar("/negocios", { q: marca, id_categoria: bano });
    expect(porCategoria.body.data.map((n) => n.id_negocio)).toEqual([pelu.id_negocio]);
  });

  describe("con coordenadas", () => {
    it("usa la sucursal activa más cercana, ordena por distancia y deja fuera lo que está fuera del radio", async () => {
      const origen = origenUnico();
      const cerca = await crearNegocio();
      await crearSucursal(cerca, { nombre: "Lejana", ...alNorte(origen, 3) });
      const cercana = await crearSucursal(cerca, { nombre: "Cercana", ...alNorte(origen, 1) });
      await crearSucursal(cerca, { nombre: "Inactiva", activo: false, ...alNorte(origen, 0.1) });
      const medio = await negocioConSucursal({}, alNorte(origen, 5));
      const lejos = await negocioConSucursal({}, alNorte(origen, 30));

      const res = await buscar("/negocios", origen);

      expect(res.status).toBe(200);
      expect(res.body.data.map((n) => n.id_negocio)).toEqual([cerca.id_negocio, medio.id_negocio]);
      expect(res.body.data[0].distancia_km).toBeCloseTo(1, 1);
      expect(res.body.data[0].sucursal_cercana).toEqual({
        id_sucursal: cercana.id_sucursal,
        nombre: "Cercana",
        direccion: cercana.direccion,
        latitud: Number(cercana.latitud),
        longitud: Number(cercana.longitud),
        // Sin horario cargado: cerrada.
        abierto_ahora: false,
        cierra_a: null,
        abre_hoy_a: null,
      });
      expect(res.body.data[1].distancia_km).toBeCloseTo(5, 1);

      const amplio = await buscar("/negocios", { ...origen, radio_km: 40 });
      expect(amplio.body.data.map((n) => n.id_negocio)).toEqual([cerca.id_negocio, medio.id_negocio, lejos.id_negocio]);
    });

    it("sin coordenadas en sucursales usa las del negocio; sin coordenadas en ningún lado queda fuera", async () => {
      const origen = origenUnico();
      const marca = unique();
      const soloNegocio = await crearNegocio(null, { nombre: `G ${marca} negocio`, ...alNorte(origen, 2) });
      const principal = await crearSucursal(soloNegocio, { es_principal: true });
      const sinCoordenadas = await negocioConSucursal({ nombre: `G ${marca} sin coordenadas` });

      const res = await buscar("/negocios", { ...origen, q: marca });

      expect(res.body.data.map((n) => n.id_negocio)).toEqual([soloNegocio.id_negocio]);
      expect(res.body.data[0].sucursal_cercana.id_sucursal).toBe(principal.id_sucursal);
      expect(res.body.data[0].distancia_km).toBeCloseTo(2, 1);

      const sinGeo = await buscar("/negocios", { q: marca });
      expect(sinGeo.body.data.map((n) => n.id_negocio).sort()).toEqual(
        [soloNegocio.id_negocio, sinCoordenadas.id_negocio].sort()
      );
    });

    it("con coordenadas, los destacados van primero", async () => {
      const origen = origenUnico();
      const cerca = await negocioConSucursal({}, alNorte(origen, 1));
      const destacado = await negocioConSucursal({ destacado: true }, alNorte(origen, 4));
      const res = await buscar("/negocios", origen);
      expect(res.body.data.map((n) => n.id_negocio)).toEqual([destacado.id_negocio, cerca.id_negocio]);
    });
  });

  it("valida lat/lng juntas, radio_km con coordenadas y máximo 50 -> 422", async () => {
    const soloLat = await buscar("/negocios", { lat: 9.3 });
    expect(soloLat.status).toBe(422);
    expect(soloLat.body.errors).toEqual({ lng: "lat y lng deben enviarse juntas" });

    const soloRadio = await buscar("/negocios", { radio_km: 5 });
    expect(soloRadio.body.errors).toEqual({ radio_km: "Requiere lat y lng" });

    const grande = await buscar("/negocios", { lat: 9.3, lng: -75.4, radio_km: 51 });
    expect(grande.status).toBe(422);
    expect((await buscar("/negocios", { tipo: "zoologico" })).status).toBe(422);
  });
});

describe("GET /servicios (búsqueda pública)", () => {
  it("solo servicios visibles y activos; reservables primero, con precio actual", async () => {
    const negocio = await negocioConSucursal();
    const empleado = await crearEmpleado(negocio);
    const reservable = await crearServicio(negocio, { nombre: "Z reservable" });
    await asignarEmpleados(reservable, [empleado]);
    const sinEmpleados = await crearServicio(negocio, { nombre: "A sin empleados" });
    const sinCita = await crearServicio(negocio, { nombre: "B sin cita", requiere_cita: false });
    await crearServicio(negocio, { nombre: "Oculto", visible_app: false });
    await crearServicio(negocio, { nombre: "Eliminado", activo: false });

    const res = await buscar("/servicios", { id_negocio: negocio.id_negocio });

    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.id_servicio)).toEqual([
      sinCita.id_servicio,
      reservable.id_servicio,
      sinEmpleados.id_servicio,
    ]);
    expect(res.body.data.map((s) => s.reservable)).toEqual([true, true, false]);
    expect(res.body.data[1]).toMatchObject({
      nombre: "Z reservable",
      negocio: { id_negocio: negocio.id_negocio, nombre: negocio.nombre, tipo: "veterinaria" },
      categoria: { nombre: "Consulta y diagnóstico", icono: "stethoscope" },
      precio_base: 50000,
      precio_actual: 50000,
      oferta_vigente: false,
      oferta_hasta: null,
      tipo_mascota: ["todos"],
      requiere_cita: true,
      distancia_km: null,
      sucursal_cercana: null,
    });
    expect(res.body.data[1]).not.toHaveProperty("empleados");
  });

  it("especie encuentra los de esa especie y los de 'todos'; pez solo 'todos'", async () => {
    const negocio = await negocioConSucursal();
    const perro = await crearServicio(negocio, { tipo_mascota: "perro" });
    const gato = await crearServicio(negocio, { tipo_mascota: "gato" });
    const todos = await crearServicio(negocio, { tipo_mascota: "todos" });
    const ids = async (especie) =>
      (await buscar("/servicios", { id_negocio: negocio.id_negocio, especie })).body.data.map((s) => s.id_servicio).sort();

    expect(await ids("perro")).toEqual([perro.id_servicio, todos.id_servicio].sort());
    expect(await ids("gato")).toEqual([gato.id_servicio, todos.id_servicio].sort());
    expect(await ids("pez")).toEqual([todos.id_servicio]);
  });

  it("en_oferta filtra por oferta vigente hoy; texto y categoría", async () => {
    const negocio = await negocioConSucursal();
    const vigente = await crearServicio(negocio, {
      nombre: "Baño promo",
      precio_base: 50000,
      en_oferta: true,
      precio_oferta: 35000,
      fecha_fin_oferta: diaRelativo(3),
      id_categoria: await categoriaServicio("Baño y estética"),
    });
    const vencida = await crearServicio(negocio, {
      nombre: "Consulta vieja promo",
      en_oferta: true,
      precio_oferta: 10000,
      fecha_fin_oferta: diaRelativo(-1),
    });
    const base = { id_negocio: negocio.id_negocio };

    const ofertas = await buscar("/servicios", { ...base, en_oferta: true });
    expect(ofertas.body.data.map((s) => s.id_servicio)).toEqual([vigente.id_servicio]);
    expect(ofertas.body.data[0]).toMatchObject({ precio_actual: 35000, oferta_vigente: true, oferta_hasta: diaRelativo(3) });

    const sinOferta = await buscar("/servicios", { ...base, en_oferta: false });
    expect(sinOferta.body.data.map((s) => s.id_servicio)).toEqual([vencida.id_servicio]);

    expect((await buscar("/servicios", { ...base, q: "bano" })).body.data.map((s) => s.id_servicio)).toEqual([
      vigente.id_servicio,
    ]);
    const porCategoria = await buscar("/servicios", { ...base, id_categoria: vigente.id_categoria });
    expect(porCategoria.body.data.map((s) => s.id_servicio)).toEqual([vigente.id_servicio]);
  });

  it("con coordenadas: distancia, reservables primero y negocios sin coordenadas fuera", async () => {
    const origen = origenUnico();
    const cerca = await negocioConSucursal({}, alNorte(origen, 1));
    const lejos = await negocioConSucursal({}, alNorte(origen, 6));
    const sinCoordenadas = await negocioConSucursal();
    const noReservableCerca = await crearServicio(cerca);
    const reservableLejos = await crearServicio(lejos, { requiere_cita: false });
    await crearServicio(sinCoordenadas, { requiere_cita: false });

    const res = await buscar("/servicios", origen);

    expect(res.body.data.map((s) => s.id_servicio)).toEqual([reservableLejos.id_servicio, noReservableCerca.id_servicio]);
    expect(res.body.data[0].distancia_km).toBeCloseTo(6, 1);
    expect(res.body.data[1].sucursal_cercana).not.toBeNull();
  });

  it("negocio inactivo o sin sucursal activa: sus servicios no aparecen", async () => {
    const inactivo = await crearNegocio(null, { activo: false });
    await crearSucursal(inactivo);
    await crearServicio(inactivo, { requiere_cita: false });
    const sinSucursal = await crearNegocio();
    await crearServicio(sinSucursal, { requiere_cita: false });

    for (const negocio of [inactivo, sinSucursal]) {
      const res = await buscar("/servicios", { id_negocio: negocio.id_negocio });
      expect(res.body.data).toEqual([]);
    }
  });

  it("parámetros inválidos -> 422", async () => {
    expect((await buscar("/servicios", { especie: "dragon" })).status).toBe(422);
    expect((await buscar("/servicios", { en_oferta: "si" })).status).toBe(422);
    expect((await buscar("/servicios", { lng: -75 })).status).toBe(422);
  });
});

describe("perfil público del negocio", () => {
  it("los servicios traen reservable, precio_actual y oferta_vigente", async () => {
    const negocio = await negocioConSucursal();
    const empleado = await crearEmpleado(negocio);
    const conEmpleado = await crearServicio(negocio, {
      nombre: "Con empleado",
      precio_base: 40000,
      en_oferta: true,
      precio_oferta: 30000,
    });
    await asignarEmpleados(conEmpleado, [empleado]);
    await crearServicio(negocio, { nombre: "Sin empleado" });

    const res = await api().get(`/negocios/${negocio.id_negocio}`);

    const servicios = Object.fromEntries(res.body.data.servicios.map((s) => [s.nombre, s]));
    expect(servicios["Con empleado"]).toMatchObject({ reservable: true, precio_actual: 30000, oferta_vigente: true });
    expect(servicios["Sin empleado"]).toMatchObject({ reservable: false, precio_actual: 50000, oferta_vigente: false });
  });
});
