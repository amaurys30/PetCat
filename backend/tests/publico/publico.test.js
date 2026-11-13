import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { limpiarCache } from "../../src/modules/publico/publico.service.js";
import { api } from "../helpers/api.js";
import { crearCita, crearNegocio, crearResena, crearSucursal, crearUsuario, unique } from "../helpers/factories.js";

const valorConfig = async (clave) => {
  const [[fila]] = await pool.query("SELECT valor FROM configuracion_global WHERE clave = ?", [clave]);
  return fila.valor;
};
const configurar = (clave, valor) =>
  pool.query("UPDATE configuracion_global SET valor = ? WHERE clave = ?", [String(valor), clave]);

const original = {};
const CLAVES = ["publico_umbral_cifras", "publico_min_resenas", "soporte_email", "soporte_whatsapp"];

beforeEach(async () => {
  for (const clave of CLAVES) original[clave] ??= await valorConfig(clave);
  limpiarCache();
});

afterAll(async () => {
  for (const [clave, valor] of Object.entries(original)) await configurar(clave, valor);
});

const conteosReales = async () => {
  const [[n]] = await pool.query(
    `SELECT COUNT(DISTINCT n.id_negocio) AS negocios, COUNT(DISTINCT s.ciudad) AS ciudades
     FROM negocios n JOIN sucursales s ON s.id_negocio = n.id_negocio AND s.activo = TRUE
     WHERE n.activo = TRUE`
  );
  const [[c]] = await pool.query("SELECT COUNT(*) AS citas FROM citas WHERE estado = 'completada'");
  return { negocios: n.negocios, ciudades: n.ciudades, citas: c.citas };
};

describe("GET /publico/estadisticas", () => {
  it("devuelve solo conteos agregados, cada uno si supera el umbral", async () => {
    await configurar("publico_umbral_cifras", 0);
    const res = await api().get("/publico/estadisticas");
    const reales = await conteosReales();

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.body.data).toEqual({
      negocios_activos: reales.negocios,
      ciudades: reales.ciudades,
      citas_atendidas: reales.citas,
    });
  });

  it("la cifra que no supera el umbral llega en null (igual al umbral tampoco lo supera)", async () => {
    const reales = await conteosReales();
    await configurar("publico_umbral_cifras", reales.ciudades);
    const res = await api().get("/publico/estadisticas");

    expect(res.body.data.ciudades).toBeNull();
    if (reales.negocios > reales.ciudades) expect(res.body.data.negocios_activos).toBe(reales.negocios);

    await configurar("publico_umbral_cifras", 1_000_000);
    limpiarCache();
    const nada = await api().get("/publico/estadisticas");
    expect(nada.body.data).toEqual({ negocios_activos: null, ciudades: null, citas_atendidas: null });
  });

  it("cuenta negocios activos con sucursal activa y ciudades distintas", async () => {
    await configurar("publico_umbral_cifras", 0);
    const antes = (await api().get("/publico/estadisticas")).body.data;
    const ciudad = `Ciudad ${unique()}`;
    const activo = await crearNegocio(null);
    await crearSucursal(activo, { ciudad });
    const inactivo = await crearNegocio(null, { activo: false });
    await crearSucursal(inactivo, { ciudad: `Otra ${unique()}` });
    await crearNegocio(null); // sin sucursal

    // En caché: no cambia hasta que vence.
    expect((await api().get("/publico/estadisticas")).body.data).toEqual(antes);

    limpiarCache();
    const despues = (await api().get("/publico/estadisticas")).body.data;
    expect(despues.negocios_activos).toBe(antes.negocios_activos + 1);
    expect(despues.ciudades).toBe(antes.ciudades + 1);
  });
});

describe("GET /publico/resenas", () => {
  /** Reseña de una cita (completada por defecto) de un negocio activo con sucursal. */
  const resenaDeCita = async (negocio, { estadoCita = "completada", fecha = "2026-09-14", autor, ...resena } = {}) => {
    const cliente = autor ?? (await crearUsuario({ nombre: "Sofía", apellido: "gómez" }));
    const cita = await crearCita(negocio, { cliente, estado: estadoCita, fecha });
    return crearResena(negocio, { id_cita: cita.id_cita, id_usuario: cliente.id_usuario, ...resena });
  };

  const negocioActivo = async (overrides) => {
    const negocio = await crearNegocio(null, { nombre: `Vet ${unique()}`, ...overrides });
    await crearSucursal(negocio);
    return negocio;
  };

  it("solo verificadas de 4 y 5 estrellas con comentario; autor como Nombre I., negocio y mes", async () => {
    await configurar("publico_min_resenas", 1);
    const negocio = await negocioActivo();
    const buena = await resenaDeCita(negocio, { calificacion: 4, comentario: "Muy amables con Rocky", titulo: "Bien" });
    await resenaDeCita(negocio, { calificacion: 3, comentario: "Regular" });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "   " });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "Oculta", visible: false });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "Reportada", reportada: true, motivo_reporte: "spam" });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "Retirada", visible: false, retirada_en: "2026-09-20 10:00:00" });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "Registrado por el negocio", cliente_registrado_por_negocio: true });
    await resenaDeCita(negocio, { calificacion: 5, comentario: "Sin cita completada", estadoCita: "cancelada" });
    await crearResena(negocio, { calificacion: 5, comentario: "Sin cita" });
    const inactivo = await negocioActivo({ activo: false });
    await resenaDeCita(inactivo, { calificacion: 5, comentario: "Negocio inactivo" });

    const res = await api().get("/publico/resenas?limit=12");

    expect(res.status).toBe(200);
    const deEsteNegocio = res.body.data.filter((r) => r.negocio.id_negocio === negocio.id_negocio);
    expect(deEsteNegocio).toEqual([
      {
        id_resena: buena.id_resena,
        calificacion: 4,
        titulo: "Bien",
        comentario: "Muy amables con Rocky",
        autor: "Sofía G.",
        negocio: { id_negocio: negocio.id_negocio, nombre: negocio.nombre, tipo: "veterinaria" },
        visita_verificada: "2026-09",
      },
    ]);
    expect(res.body.data.some((r) => r.negocio.id_negocio === inactivo.id_negocio)).toBe(false);
    for (const r of res.body.data) {
      expect(r.calificacion).toBeGreaterThanOrEqual(4);
      expect(r).not.toHaveProperty("id_usuario");
      expect(r.negocio).not.toHaveProperty("email");
    }
  });

  it("como máximo 2 por negocio, las más recientes primero, y respeta el límite", async () => {
    await configurar("publico_min_resenas", 1);
    const negocio = await negocioActivo();
    const ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await resenaDeCita(negocio, { comentario: `Excelente ${i}` })).id_resena);

    const res = await api().get("/publico/resenas?limit=12");
    const deEsteNegocio = res.body.data.filter((r) => r.negocio.id_negocio === negocio.id_negocio);
    expect(deEsteNegocio.map((r) => r.id_resena)).toEqual([ids[2], ids[1]]);

    limpiarCache();
    expect((await api().get("/publico/resenas?limit=1")).body.data).toHaveLength(1);
  });

  it("con menos reseñas elegibles que el mínimo, la lista llega vacía", async () => {
    await configurar("publico_min_resenas", 1_000_000);
    const res = await api().get("/publico/resenas");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("valida el límite", async () => {
    const res = await api().get("/publico/resenas?limit=50");
    expect(res.status).toBe(422);
  });
});

describe("GET /publico/configuracion", () => {
  it("soporte configurado y días de la prueba Pro", async () => {
    await configurar("soporte_email", "soporte@petcat.test");
    await configurar("soporte_whatsapp", "+57 300 000 0000");
    const res = await api().get("/publico/configuracion");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      soporte: { email: "soporte@petcat.test", whatsapp: "+57 300 000 0000" },
      prueba_pro_dias: 14,
    });
  });

  it("soporte vacío llega en null", async () => {
    await configurar("soporte_email", " ");
    await configurar("soporte_whatsapp", "");
    const res = await api().get("/publico/configuracion");
    expect(res.body.data.soporte).toEqual({ email: null, whatsapp: null });
  });
});
