import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

/** Dashboard del negocio (2.7): lo básico, ingresos registrados, citas perdidas y el bloqueo por plan. */

const dia = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return hoyISO(d);
};

/**
 * Negocio con citas en los últimos 30 días (y una de hace 40), dos sedes y dos servicios:
 * 4 completadas (180.000), 1 inasistencia, 3 canceladas (2 por el sistema, 1 tardía del
 * dueño), 1 reprogramada, 2 de hoy y 1 pendiente para mañana.
 */
const negocioConCitas = async (opciones = {}) => {
  const negocio = await crearNegocio(null, opciones);
  const norte = await crearSucursal(negocio, { nombre: "Norte" });
  const sur = await crearSucursal(negocio, { nombre: "Sur" });
  const consulta = await crearServicio(negocio, { nombre: "Consulta" });
  const bano = await crearServicio(negocio, { nombre: "Baño" });
  const vet = await crearEmpleado(negocio, { nombre: "Vera", apellido: "Díaz" });
  const antiguo = await crearUsuario();
  const cita = async (dueno, datos) =>
    crearCita(negocio, { cliente: dueno, mascota: await crearMascota(dueno), servicio: consulta, id_sucursal: norte.id_sucursal, ...datos });

  await cita(antiguo, { fecha: dia(-40), estado: "completada", precio_final: 99000 });
  await cita(antiguo, { fecha: dia(-2), estado: "completada", precio_final: 50000, id_empleado: vet.id_empleado, hora_inicio: "09:00:00" });
  const frecuente = await crearUsuario();
  await cita(frecuente, { fecha: dia(-5), estado: "completada", precio_final: 50000, id_empleado: vet.id_empleado, hora_inicio: "09:00:00" });
  await cita(frecuente, { fecha: dia(-10), estado: "completada", precio_final: 50000, hora_inicio: "15:00:00" });
  await cita(await crearUsuario(), { fecha: dia(-3), estado: "completada", precio_final: 30000, servicio: bano, id_sucursal: sur.id_sucursal });
  await cita(await crearUsuario(), { fecha: dia(-4), estado: "no_asistio" });
  for (const d of [-6, -7]) await cita(await crearUsuario(), { fecha: dia(d), estado: "cancelada", cancelada_por: "sistema" });
  await cita(await crearUsuario(), { fecha: dia(-8), estado: "cancelada", cancelada_por: "dueno", cancelacion_tardia: true });
  await cita(await crearUsuario(), { fecha: dia(-9), estado: "reprogramada" });
  await cita(await crearUsuario(), { fecha: dia(0), estado: "confirmada" });
  await cita(await crearUsuario(), { fecha: dia(0), estado: "pendiente" });
  await cita(await crearUsuario(), { fecha: dia(1), estado: "pendiente" });

  return { negocio, norte, sur, vet, url: `/negocios/${negocio.id_negocio}/dashboard`, panel: api(await tokenDe(negocio.propietario)) };
};

describe("dashboard básico", () => {
  it("citas, inasistencia, ingresos registrados, servicios, clientes nuevos y citas perdidas; avanzadas bloqueadas en Gratuito", async () => {
    const ctx = await negocioConCitas();
    const res = await ctx.panel.get(ctx.url);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.periodo).toEqual({ desde: dia(-29), hasta: dia(0), dias: 30 });
    expect(d.plan).toMatchObject({ nombre: "Gratuito", estadisticas_avanzadas: false, rango_maximo_dias: 92 });
    expect(d.prueba_disponible).toBe(true);
    expect(d.hoy).toMatchObject({ fecha: dia(0), total: 2, por_confirmar: 2 });
    expect(d.hoy.por_estado).toMatchObject({ confirmada: 1, pendiente: 1 });
    expect(d.citas.por_estado).toEqual({
      pendiente: 1,
      confirmada: 1,
      en_curso: 0,
      completada: 4,
      cancelada: 3,
      no_asistio: 1,
      reprogramada: 1,
    });
    expect(d.citas.total).toBe(10); // sin la reprogramada
    expect(d.tasa_inasistencia).toEqual({ porcentaje: 20, inasistencias: 1, base: 5 });
    expect(d.ingresos).toMatchObject({
      total: 180000,
      citas_completadas: 4,
      ticket_promedio: 45000,
      moneda: "COP",
      origen: "citas_completadas",
      verificado: false,
    });
    expect(d.ingresos.nota).toContain("No son pagos verificados");
    expect(d.servicios_mas_pedidos.map((s) => [s.nombre, s.completadas, s.ingresos])).toEqual([
      ["Consulta", 3, 150000],
      ["Baño", 1, 30000],
    ]);
    // Todos menos el que ya venía de hace 40 días y el de la cita de mañana (fuera del periodo).
    expect(d.clientes_nuevos).toBe(9);
    expect(d.citas_perdidas_por_no_confirmar).toEqual({
      total: 2,
      sugerencia: {
        codigo: "activar_confirmacion_automatica",
        mensaje:
          "2 citas se cancelaron porque nadie las confirmó a tiempo. Con la confirmación automática, las reservas de la app quedan confirmadas al instante.",
      },
    });

    const bloqueada = { bloqueado: true, plan_requerido: { id_plan: expect.any(Number), nombre: "Pro", precio_mensual: 120000 } };
    expect(Object.keys(d.avanzadas).sort()).toEqual(
      ["cancelaciones", "comparacion", "horas_pico", "por_empleado", "por_sucursal", "recurrencia", "tendencia"].sort()
    );
    for (const seccion of Object.values(d.avanzadas)) expect(seccion).toEqual(bloqueada);
  });

  it("con la confirmación automática activa no hay sugerencia; filtro por sucursal", async () => {
    const ctx = await negocioConCitas();
    await pool.query("UPDATE negocios SET confirmacion_automatica = TRUE WHERE id_negocio = ?", [ctx.negocio.id_negocio]);
    const res = await ctx.panel.get(ctx.url);
    expect(res.body.data.citas_perdidas_por_no_confirmar).toEqual({ total: 2, sugerencia: null });

    const sur = await ctx.panel.get(`${ctx.url}?id_sucursal=${ctx.sur.id_sucursal}`);
    expect(sur.body.data.id_sucursal).toBe(ctx.sur.id_sucursal);
    expect(sur.body.data.ingresos).toMatchObject({ total: 30000, citas_completadas: 1 });
    expect(sur.body.data.hoy.total).toBe(0);

    const ajena = await crearSucursal(await crearNegocio());
    const res422 = await ctx.panel.get(`${ctx.url}?id_sucursal=${ajena.id_sucursal}`);
    expect(res422.status).toBe(422);
    expect(res422.body.errors).toEqual({ id_sucursal: "No pertenece a este negocio" });
  });

  it("rango: Gratuito hasta 92 días (más: 422 con plan_requerido), nunca futuro ni al revés", async () => {
    const ctx = await negocioConCitas();
    expect((await ctx.panel.get(`${ctx.url}?desde=${dia(-91)}&hasta=${dia(0)}`)).status).toBe(200);

    const largo = await ctx.panel.get(`${ctx.url}?desde=${dia(-92)}&hasta=${dia(0)}`);
    expect(largo.status).toBe(422);
    expect(largo.body).toMatchObject({
      message: "Tu plan Gratuito permite ver hasta 92 días",
      errors: { hasta: "El rango máximo es de 92 días", plan_requerido: "Pro" },
    });

    const futuro = await ctx.panel.get(`${ctx.url}?hasta=${dia(1)}`);
    expect(futuro.status).toBe(422);
    expect(futuro.body.errors.hasta).toBe("No puede ser posterior a hoy: lo que viene está en la agenda");
    expect((await ctx.panel.get(`${ctx.url}?desde=${dia(-1)}&hasta=${dia(-2)}`)).status).toBe(422);

    // Solo desde: hasta hoy. Solo hasta: los 30 días anteriores.
    expect((await ctx.panel.get(`${ctx.url}?desde=${dia(-5)}`)).body.data.periodo).toEqual({ desde: dia(-5), hasta: dia(0), dias: 6 });
    expect((await ctx.panel.get(`${ctx.url}?hasta=${dia(-10)}`)).body.data.periodo).toEqual({ desde: dia(-39), hasta: dia(-10), dias: 30 });
  });

  it("requiere reportes.ver: Administrador sí, Recepcionista no", async () => {
    const ctx = await negocioConCitas();
    const admin = await crearUsuario();
    const recepcion = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: admin, rol: "Administrador" });
    await crearEmpleado(ctx.negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await api(await tokenDe(admin)).get(ctx.url)).status).toBe(200);
    expect((await api(await tokenDe(recepcion)).get(ctx.url)).status).toBe(403);
    expect((await api().get(ctx.url)).status).toBe(401);
  });
});

describe("dashboard avanzado", () => {
  it("Pro: tendencia diaria, comparación, por empleado y sucursal, horas pico, recurrencia y cancelaciones", async () => {
    const ctx = await negocioConCitas({ plan: "Pro" });
    const d = (await ctx.panel.get(ctx.url)).body.data;
    expect(d.plan).toMatchObject({ nombre: "Pro", estadisticas_avanzadas: true, rango_maximo_dias: 366 });
    expect(d.prueba_disponible).toBe(false);
    const a = d.avanzadas;

    expect(a.tendencia.agrupacion).toBe("dia");
    expect(a.tendencia.puntos).toHaveLength(30);
    expect(a.tendencia.puntos.find((p) => p.inicio === dia(-2))).toEqual({ inicio: dia(-2), citas: 1, completadas: 1, ingresos: 50000 });
    expect(a.tendencia.puntos.reduce((s, p) => s + p.ingresos, 0)).toBe(180000);

    expect(a.comparacion).toMatchObject({
      periodo_anterior: { desde: dia(-59), hasta: dia(-30) },
      actual: { completadas: 4, ingresos: 180000, clientes_nuevos: 9, tasa_inasistencia: 20 },
      anterior: { completadas: 1, ingresos: 99000, clientes_nuevos: 1, tasa_inasistencia: 0 },
      // Contra un periodo anterior en 0 no hay porcentaje.
      variacion_pct: { completadas: 300, ingresos: 81.8, clientes_nuevos: 800, tasa_inasistencia: null },
    });
    expect(a.por_empleado).toEqual([
      { empleado: { id_empleado: ctx.vet.id_empleado, nombre: "Vera", apellido: "Díaz" }, citas: 2, completadas: 2, ingresos: 100000, inasistencias: 0 },
      // Sin asignar: 2 completadas, la inasistencia y las 2 de hoy (sin canceladas ni reprogramadas).
      { empleado: null, citas: 5, completadas: 2, ingresos: 80000, inasistencias: 1 },
    ]);
    expect(a.por_sucursal.map((s) => [s.sucursal.nombre, s.completadas, s.ingresos])).toEqual([
      ["Norte", 3, 150000],
      ["Sur", 1, 30000],
    ]);
    expect(a.horas_pico[0]).toMatchObject({ hora: 9, citas: expect.any(Number) });
    expect(a.recurrencia).toEqual({ clientes: 3, recurrentes: 1, porcentaje: 33.3 });
    expect(a.cancelaciones).toEqual({ total: 3, por_dueno: 1, por_negocio: 0, por_sistema: 2, tardias: 1 });
  });

  it("rango de Pro hasta 366 días: agrupa por semana hasta 92 días y por mes en rangos mayores", async () => {
    const ctx = await negocioConCitas({ plan: "Pro" });
    const semana = (await ctx.panel.get(`${ctx.url}?desde=${dia(-59)}`)).body.data.avanzadas.tendencia;
    expect(semana.agrupacion).toBe("semana");
    expect(new Date(`${semana.puntos[0].inicio}T12:00:00`).getDay()).toBe(1); // lunes
    expect(semana.puntos.reduce((s, p) => s + p.ingresos, 0)).toBe(279000);

    const mes = (await ctx.panel.get(`${ctx.url}?desde=${dia(-199)}`)).body.data.avanzadas.tendencia;
    expect(mes.agrupacion).toBe("mes");
    expect(mes.puntos.every((p) => p.inicio.endsWith("-01"))).toBe(true);
    expect(mes.puntos.at(-1).inicio).toBe(`${dia(0).slice(0, 7)}-01`);

    expect((await ctx.panel.get(`${ctx.url}?desde=${dia(-365)}`)).status).toBe(200);
    const largo = await ctx.panel.get(`${ctx.url}?desde=${dia(-366)}`);
    expect(largo.status).toBe(422);
    expect(largo.body.errors).toEqual({ hasta: "El rango máximo es de 366 días" });
  });

  it("la prueba Pro desbloquea; un plan Pro vencido vuelve a bloquear", async () => {
    const ctx = await negocioConCitas();
    expect((await ctx.panel.post(`/negocios/${ctx.negocio.id_negocio}/suscripcion/prueba-pro`)).status).toBe(201);
    const enPrueba = (await ctx.panel.get(ctx.url)).body.data;
    expect(enPrueba.plan.estadisticas_avanzadas).toBe(true);
    expect(enPrueba.avanzadas.tendencia).not.toHaveProperty("bloqueado");

    await pool.query("UPDATE suscripciones SET fecha_prueba_fin = ?, fecha_fin = ? WHERE id_negocio = ? AND estado = 'en_prueba'", [
      dia(-1),
      dia(-1),
      ctx.negocio.id_negocio,
    ]);
    const vencida = (await ctx.panel.get(ctx.url)).body.data;
    expect(vencida.plan).toMatchObject({ nombre: "Gratuito", rango_maximo_dias: 92 });
    expect(vencida.prueba_disponible).toBe(false); // la prueba se usa una sola vez
    expect(vencida.avanzadas.tendencia.bloqueado).toBe(true);
  });
});
