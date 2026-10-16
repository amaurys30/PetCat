import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { comparePassword } from "../../src/shared/utils/hash.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";

const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

// El seed de desarrollo se carga en petcat_test (globalSetup): si el esquema cambia
// y el seed deja de ser válido, estos tests fallan.
describe("seed de desarrollo", () => {
  it("crea los usuarios documentados con la contraseña Petcat123!", async () => {
    const [rows] = await pool.query(
      "SELECT email, tipo_usuario, password_hash, apellido FROM usuarios WHERE email LIKE '%@petcat.test' AND email IN (?) ORDER BY email",
      [["admin@petcat.test", "propietario@petcat.test", "veterinario@petcat.test", "cliente@petcat.test"]]
    );
    expect(rows.map((r) => [r.email, r.tipo_usuario])).toEqual([
      ["admin@petcat.test", "admin"],
      ["cliente@petcat.test", "cliente"],
      ["propietario@petcat.test", "negocio"],
      ["veterinario@petcat.test", "cliente"],
    ]);
    for (const row of rows) {
      expect(await comparePassword("Petcat123!", row.password_hash)).toBe(true);
    }
    // Los acentos llegan bien (utf8mb4 de punta a punta).
    expect(rows.find((r) => r.email === "propietario@petcat.test").apellido).toBe("Martínez");
  });

  it("el propietario puede iniciar sesión", async () => {
    const res = await api()
      .post("/auth/login")
      .send({ email: "propietario@petcat.test", password: "Petcat123!" });
    expect(res.status).toBe(200);
  });

  it("el negocio tiene plan Gratuito sin vencimiento, sucursal principal y horarios", async () => {
    const [[negocio]] = await pool.query(
      `SELECT n.id_negocio, p.nombre AS plan, s.estado, s.fecha_fin
       FROM negocios n
       JOIN suscripciones s ON s.id_negocio = n.id_negocio
       JOIN planes_suscripcion p ON p.id_plan = s.id_plan
       WHERE n.nombre = 'Clínica Veterinaria Patitas'`
    );
    expect(negocio).toMatchObject({ plan: "Gratuito", estado: "activa", fecha_fin: "9999-12-31" });

    const [sucursales] = await pool.query(
      "SELECT id_sucursal, es_principal FROM sucursales WHERE id_negocio = ?",
      [negocio.id_negocio]
    );
    expect(sucursales).toHaveLength(1);
    expect(sucursales[0].es_principal).toBe(1);

    // Horario partido: dos rangos de lunes a viernes y uno el sábado.
    const [[{ dias, rangos }]] = await pool.query(
      "SELECT COUNT(DISTINCT dia_semana) AS dias, COUNT(*) AS rangos FROM horarios_negocio WHERE id_sucursal = ?",
      [sucursales[0].id_sucursal]
    );
    expect(dias).toBe(6);
    expect(rangos).toBe(11);
  });

  it("veterinario vinculado y recepcionista con invitación pendiente (token guardado como SHA-256)", async () => {
    const [empleados] = await pool.query(
      `SELECT e.email, e.id_usuario, r.nombre AS rol
       FROM empleados e JOIN roles r ON r.id_rol = e.id_rol
       WHERE e.email IN ('veterinario@petcat.test', 'recepcionista@petcat.test')
       ORDER BY e.email`
    );
    expect(empleados.map((e) => [e.email, e.rol, e.id_usuario !== null])).toEqual([
      ["recepcionista@petcat.test", "Recepcionista", false],
      ["veterinario@petcat.test", "Veterinario", true],
    ]);

    const tokenDemo = "5eed" + "0".repeat(59) + "1";
    const hash = createHash("sha256").update(tokenDemo).digest("hex");
    const [[invitacion]] = await pool.query(
      "SELECT usado, expiracion > NOW() AS vigente FROM invitaciones_empleado WHERE token = ?",
      [hash]
    );
    expect(invitacion).toMatchObject({ usado: 0, vigente: 1 });
  });

  it("cliente con dos mascotas y tres servicios del negocio", async () => {
    const [mascotas] = await pool.query(
      `SELECT m.nombre FROM mascotas m JOIN usuarios u ON u.id_usuario = m.id_usuario
       WHERE u.email = 'cliente@petcat.test' ORDER BY m.nombre`
    );
    expect(mascotas.map((m) => m.nombre)).toEqual(["Luna", "Max"]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM servicios s JOIN negocios n ON n.id_negocio = s.id_negocio
       WHERE n.nombre = 'Clínica Veterinaria Patitas'`
    );
    expect(total).toBe(3);
  });

  it("cada usuario del seed tiene su autorización de datos para la versión vigente", async () => {
    const [filas] = await pool.query(
      `SELECT u.email, COUNT(a.id_autorizacion) AS autorizaciones
       FROM usuarios u
       LEFT JOIN autorizaciones_datos a ON a.id_usuario = u.id_usuario
         AND a.version_politica = (SELECT valor FROM configuracion_global WHERE clave = 'terminos_version')
       WHERE u.email IN ('admin@petcat.test', 'propietario@petcat.test', 'veterinario@petcat.test', 'cliente@petcat.test')
       GROUP BY u.email`
    );
    expect(filas).toHaveLength(4);
    expect(filas.every((f) => f.autorizaciones === 1)).toBe(true);
  });

  it("el veterinario atiende la consulta y la vacuna; el baño no tiene empleados", async () => {
    const [filas] = await pool.query(
      `SELECT s.nombre, e.email
       FROM servicios s
       JOIN negocios n ON n.id_negocio = s.id_negocio
       LEFT JOIN empleado_servicios es ON es.id_servicio = s.id_servicio
       LEFT JOIN empleados e ON e.id_empleado = es.id_empleado
       WHERE n.nombre = 'Clínica Veterinaria Patitas'
       ORDER BY s.nombre`
    );
    // Otros profesionales pueden atender la consulta y la vacuna (la agenda del seed tiene dos).
    expect(filas.filter((f) => f.nombre === "Baño y corte")).toEqual([{ nombre: "Baño y corte", email: null }]);
    expect(filas).toEqual(
      expect.arrayContaining([
        { nombre: "Consulta general", email: "veterinario@petcat.test" },
        { nombre: "Vacuna antirrábica", email: "veterinario@petcat.test" },
      ])
    );
  });
});

// Datos para diseñar: se comprueban a través de la API, como los verá el equipo.
describe("seed de desarrollo: datos realistas", () => {
  const login = async (email) =>
    (await api().post("/auth/login").send({ email, password: "Petcat123!" })).body.data.access_token;
  const idNegocio = async (nombre) => (await pool.query("SELECT id_negocio FROM negocios WHERE nombre = ?", [nombre]))[0][0].id_negocio;
  const idMascota = async (email, nombre) =>
    (
      await pool.query(
        "SELECT m.id_mascota FROM mascotas m JOIN usuarios u ON u.id_usuario = m.id_usuario WHERE u.email = ? AND m.nombre = ?",
        [email, nombre]
      )
    )[0][0].id_mascota;
  const idUsuario = async (email) => (await pool.query("SELECT id_usuario FROM usuarios WHERE email = ?", [email]))[0][0].id_usuario;

  const NEGOCIOS = [
    "Clínica Veterinaria Patitas",
    "Peluquería Canina Huellitas",
    "Guardería Patas Felices",
    "Centro Veterinario Salud Animal 24h",
  ];

  it("vet.salud entra a dos negocios (selector del panel), con el rol y los permisos de cada uno", async () => {
    const res = await api(await login("vet.salud@petcat.test")).get("/negocios/mios");
    expect(res.body.data.map((n) => [n.nombre, n.relacion, n.rol.nombre])).toEqual([
      ["Centro Veterinario Salud Animal 24h", "empleado", "Veterinario"],
      ["Peluquería Canina Huellitas", "empleado", "Recepcionista"],
    ]);
    expect(res.body.data[1].rol.permisos_json.citas).toEqual(expect.arrayContaining(["ver", "crear"]));
  });

  it("cuatro negocios de distintos tipos en Sincelejo, con coordenadas y calificación por reseñas", async () => {
    const [filas] = await pool.query(
      "SELECT nombre, tipo, ciudad, latitud, calificacion_promedio, total_resenas FROM negocios WHERE nombre IN (?) ORDER BY id_negocio",
      [NEGOCIOS]
    );
    expect(filas.map((f) => f.tipo)).toEqual(["veterinaria", "peluqueria_canina", "guarderia", "clinica"]);
    expect(filas.every((f) => f.ciudad === "Sincelejo" && f.latitud !== null)).toBe(true);
    // Huellitas: la reseña bajó a 3 al editarla; Salud Animal: 5, 2 (reportada, sigue contando) y 5.
    expect(filas.map((f) => [f.total_resenas, f.calificacion_promedio])).toEqual([
      [1, "5.00"],
      [1, "3.00"],
      [1, "5.00"],
      [3, "4.00"],
    ]);

    const [[salud]] = await pool.query(
      `SELECT p.nombre AS plan, s.estado, COUNT(DISTINCT su.id_sucursal) AS sucursales
       FROM negocios n JOIN suscripciones s ON s.id_negocio = n.id_negocio
       JOIN planes_suscripcion p ON p.id_plan = s.id_plan JOIN sucursales su ON su.id_negocio = n.id_negocio
       WHERE n.nombre = ? GROUP BY p.nombre, s.estado`,
      [NEGOCIOS[3]]
    );
    expect(salud).toEqual({ plan: "Pro", estado: "en_prueba", sucursales: 2 });
  });

  it("servicios con oferta vigente, con oferta vencida y sin oferta", async () => {
    const servicios = async (nombre) => (await api().get(`/negocios/${await idNegocio(nombre)}`)).body.data.servicios;
    const patitas = await servicios(NEGOCIOS[0]);
    expect(patitas.find((s) => s.nombre === "Vacuna antirrábica")).toMatchObject({ oferta_vigente: true, precio_actual: 38000 });
    expect(patitas.find((s) => s.nombre === "Consulta general")).toMatchObject({ oferta_vigente: false, precio_actual: 60000 });
    const salud = await servicios(NEGOCIOS[3]);
    expect(salud.find((s) => s.nombre === "Desparasitación")).toMatchObject({ oferta_vigente: false, precio_actual: 35000 });
  });

  it("citas en los siete estados, pasadas y futuras, con cancelación tardía, del negocio y reprogramación", async () => {
    const [filas] = await pool.query(
      `SELECT DISTINCT c.estado
       FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio WHERE n.nombre IN (?)`,
      [NEGOCIOS]
    );
    expect(filas.map((f) => f.estado).sort()).toEqual(
      ["cancelada", "completada", "confirmada", "en_curso", "no_asistio", "pendiente", "reprogramada"]
    );
    const [[{ tardias, del_negocio, reprogramaciones }]] = await pool.query(
      `SELECT SUM(cancelacion_tardia) AS tardias, SUM(cancelada_por = 'negocio') AS del_negocio,
              SUM(id_cita_origen IS NOT NULL) AS reprogramaciones FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
       WHERE n.nombre IN (?)`,
      [NEGOCIOS]
    );
    expect([Number(tardias), Number(del_negocio), Number(reprogramaciones)]).toEqual([1, 1, 1]);
  });

  it("resumen de salud de Max: vacuna vencida, vacuna próxima, control pendiente y próxima cita", async () => {
    const token = await login("cliente@petcat.test");
    const res = await api(token).get(`/mascotas/${await idMascota("cliente@petcat.test", "Max")}/resumen-salud`);
    expect(res.status).toBe(200);
    expect(res.body.data.vacunas_vencidas.map((v) => v.nombre_vacuna)).toEqual(["Antirrábica"]);
    expect(res.body.data.vacunas_proximas.map((v) => v.nombre_vacuna)).toEqual(["Parvovirus"]);
    expect(res.body.data.proximo_control).not.toBeNull();
    expect(res.body.data.proxima_cita).not.toBeNull();
    expect(res.body.data.evolucion_peso.puntos.length).toBeGreaterThanOrEqual(2);
  });

  it("clientes de Patitas y Salud Animal: cumplimiento, cliente sin app y cita fuera de disponibilidad", async () => {
    const patitas = await idNegocio(NEGOCIOS[0]);
    const tokenPatitas = await login("propietario@petcat.test");
    const sofia = await api(tokenPatitas).get(`/negocios/${patitas}/clientes/${await idUsuario("cliente@petcat.test")}`);
    expect(sofia.body.data.historial_cumplimiento).toEqual({ completadas: 2, inasistencias: 1, cancelaciones_tardias: 1 });

    const salud = await idNegocio(NEGOCIOS[3]);
    const tokenSalud = await login("saludanimal@petcat.test");
    const jorge = await api(tokenSalud).get(`/negocios/${salud}/clientes/${await idUsuario("jorge@petcat.test")}`);
    expect(jorge.body.data.cliente).toMatchObject({ registrado_por_el_negocio: true, usa_app: false });
    expect(jorge.body.data.historial_cumplimiento.inasistencias).toBe(1);

    const agenda = await api(tokenSalud).get(`/negocios/${salud}/citas?desde=${hoyISO()}&hasta=${sumarDias(hoyISO(), 30)}&limit=100`);
    expect(agenda.status).toBe(200);
    expect(agenda.body.data.filter((c) => c.fuera_de_disponibilidad)).toHaveLength(1);
  });

  it("agenda de Patitas: dos profesionales, pendientes con plazo y una cita fuera por un bloqueo personal", async () => {
    const patitas = await idNegocio(NEGOCIOS[0]);
    const token = await login("propietario@petcat.test");
    const profesionales = (await api(token).get(`/negocios/${patitas}/profesionales`)).body.data;
    expect(profesionales.filter((p) => p.servicios.length > 0).map((p) => p.nombre)).toEqual(
      expect.arrayContaining(["Carlos", "Paula"])
    );

    const { por_confirmar, fuera_de_disponibilidad } = (await api(token).get(`/negocios/${patitas}/citas/atencion`)).body.data;
    expect(por_confirmar.length).toBeGreaterThanOrEqual(2);
    expect(por_confirmar.every((c) => c.confirmar_antes_de !== null)).toBe(true);
    expect(fuera_de_disponibilidad.map((c) => c.motivo_fuera)).toContainEqual({ tipo: "bloqueo", motivo: "Cita médica personal" });

    const agenda = (await api(token).get(`/negocios/${patitas}/citas?desde=${sumarDias(hoyISO(), -3)}&hasta=${sumarDias(hoyISO(), 5)}`)).body.data;
    const conCruce = agenda.some((a) =>
      agenda.some((b) => a.id_cita !== b.id_cita && a.fecha === b.fecha && a.hora_inicio === b.hora_inicio && a.empleado.id_empleado !== b.empleado.id_empleado)
    );
    expect(conCruce).toBe(true);
  });

  it("cada cita tiene su creación en el historial, y una completada llega a completada en orden", async () => {
    // Solo las del seed: las fábricas de los otros tests crean citas sin historial.
    const [[{ sin_creacion }]] = await pool.query(
      `SELECT COUNT(*) AS sin_creacion FROM citas c JOIN negocios n ON n.id_negocio = c.id_negocio
       WHERE n.nombre IN (?) AND NOT EXISTS (SELECT 1 FROM historial_citas h
                         WHERE h.id_cita = c.id_cita AND h.campo_modificado = 'estado' AND h.valor_anterior IS NULL)`,
      [NEGOCIOS]
    );
    expect(Number(sin_creacion)).toBe(0);

    const patitas = await idNegocio(NEGOCIOS[0]);
    const [[completada]] = await pool.query(
      "SELECT id_cita FROM citas WHERE id_negocio = ? AND estado = 'completada' AND origen = 'app_movil' LIMIT 1",
      [patitas]
    );
    const historial = (await api(await login("propietario@petcat.test")).get(`/citas/${completada.id_cita}/historial`)).body.data;
    const estados = historial.filter((h) => h.campo === "estado").map((h) => [h.valor_anterior, h.valor_nuevo, h.realizado_por]);
    expect(estados).toEqual([
      [null, "pendiente", "dueno"],
      ["pendiente", "confirmada", "negocio"],
      ["confirmada", "en_curso", "negocio"],
      ["en_curso", "completada", "negocio"],
    ]);
  });

  it("Rocky no comparte su historial: Salud Animal ve solo su registro; la dueña de Rocky ve ambos", async () => {
    const rocky = await idMascota("camilo@petcat.test", "Rocky");
    const salud = await idNegocio(NEGOCIOS[3]);
    const panel = await api(await login("vet.salud@petcat.test")).get(`/negocios/${salud}/mascotas/${rocky}/resumen-salud`);
    expect(panel.status).toBe(200);
    expect(panel.body.data.ultimo_control.negocio.id_negocio).toBe(salud);
    expect(panel.body.data.mascota.alergias_detalle).toBe("Pollo y derivados");

    const [[{ registros }]] = await pool.query("SELECT COUNT(*) AS registros FROM historial_medico WHERE id_mascota = ?", [rocky]);
    expect(registros).toBe(2);
  });

  // ---------- Fase 2 ----------

  it("reseñas: respuesta, editada después de la respuesta, reportada visible y la señal solo para el super admin", async () => {
    const publicas = async (nombre) => (await api().get(`/negocios/${await idNegocio(nombre)}/resenas`)).body;
    const patitas = await publicas(NEGOCIOS[0]);
    expect(patitas.data[0]).toMatchObject({ autor: "Sofía G.", respuesta: { editada: false }, editada_despues_de_respuesta: false });
    expect(patitas.data[0].respuesta.texto).toContain("Max es un paciente");

    const huellitas = await publicas(NEGOCIOS[1]);
    expect(huellitas.data[0]).toMatchObject({ calificacion: 3, editada_despues_de_respuesta: true });

    const salud = await publicas(NEGOCIOS[3]);
    expect(salud.data.map((r) => r.calificacion).sort()).toEqual([2, 5, 5]); // la reportada sigue publicada
    expect(salud.meta.resumen).toMatchObject({ calificacion_promedio: 4, total_resenas: 3 });

    const url = `/negocios/${await idNegocio(NEGOCIOS[3])}/resenas/gestion`;
    const panel = (await api(await login("saludanimal@petcat.test")).get(url)).body.data;
    expect(panel.find((r) => r.reporte)).toMatchObject({ calificacion: 2, reporte: { motivo: "otro" } });
    expect(panel.every((r) => !("cliente_registrado_por_negocio" in r))).toBe(true);
    const admin = (await api(await login("admin@petcat.test")).get(url)).body.data;
    expect(admin.filter((r) => r.cliente_registrado_por_negocio).map((r) => r.cliente.nombre)).toEqual(["Jorge"]);
  });

  it("la guardería (Gratuito) está cerca de sus límites: 3 de 3 empleados, 24 o más de 30 citas del mes y el aviso del 80 %", async () => {
    const guarderia = await idNegocio(NEGOCIOS[2]);
    const token = await login("guarderia@petcat.test");
    const { uso } = (await api(token).get(`/negocios/${guarderia}/suscripcion`)).body.data;
    expect(uso.empleados).toEqual({ usadas: 3, maximo: 3 });
    expect(uso.citas_mes.maximo).toBe(30);
    expect(uso.citas_mes.usadas).toBeGreaterThanOrEqual(24);
    expect(uso.citas_mes.usadas).toBeLessThan(30);

    const avisos = (await api(token).get("/notificaciones?leidas=false")).body.data;
    expect(avisos.map((n) => n.tipo)).toContain("plan_limite_80");
  });

  it("dashboard: Patitas con citas perdidas por no confirmar y avanzadas bloqueadas; Salud Animal con 90 días de tendencia", async () => {
    const patitas = await idNegocio(NEGOCIOS[0]);
    const gratuito = (await api(await login("propietario@petcat.test")).get(`/negocios/${patitas}/dashboard`)).body.data;
    expect(gratuito.citas_perdidas_por_no_confirmar.total).toBe(2);
    expect(gratuito.citas_perdidas_por_no_confirmar.sugerencia.codigo).toBe("activar_confirmacion_automatica");
    expect(gratuito.avanzadas.tendencia).toMatchObject({ bloqueado: true, plan_requerido: { nombre: "Pro" } });

    const salud = await idNegocio(NEGOCIOS[3]);
    const res = await api(await login("saludanimal@petcat.test")).get(`/negocios/${salud}/dashboard?desde=${sumarDias(hoyISO(), -89)}`);
    const pro = res.body.data;
    expect(pro.plan.estadisticas_avanzadas).toBe(true);
    expect(pro.avanzadas.tendencia.agrupacion).toBe("semana");
    expect(pro.avanzadas.tendencia.puntos.filter((p) => p.completadas > 0).length).toBeGreaterThanOrEqual(8);
    expect(pro.ingresos.citas_completadas).toBeGreaterThanOrEqual(14);
    expect(pro.avanzadas.por_empleado.length).toBe(2);
  });

  it("notificaciones leídas y sin leer, dispositivos de ejemplo y notas de clientes", async () => {
    const sofia = await login("cliente@petcat.test");
    const notificaciones = (await api(sofia).get("/notificaciones")).body;
    expect(notificaciones.data.map((n) => [n.tipo, n.leida])).toEqual(
      expect.arrayContaining([
        ["vacuna_proxima", false],
        ["cita_confirmada", true],
      ])
    );
    expect(notificaciones.data.find((n) => n.tipo === "cita_confirmada").datos).toMatchObject({ tipo: "cita_confirmada", id_cita: expect.any(Number) });

    const [dispositivos] = await pool.query(
      "SELECT u.email FROM dispositivos d JOIN usuarios u ON u.id_usuario = d.id_usuario WHERE d.activo = TRUE AND d.token_expo LIKE 'ExponentPushToken[seed%' ORDER BY u.email"
    );
    expect(dispositivos.map((d) => d.email)).toEqual(["camilo@petcat.test", "cliente@petcat.test"]);

    const salud = await idNegocio(NEGOCIOS[3]);
    const jorge = await idUsuario("jorge@petcat.test");
    const notas = (await api(await login("vet.salud@petcat.test")).get(`/negocios/${salud}/clientes/${jorge}/notas`)).body.data;
    expect(notas).toEqual([expect.objectContaining({ autor: expect.objectContaining({ nombre: "Ricardo" }), editable: false })]);
    // Otro negocio del mismo cliente no las ve.
    const camilo = await idUsuario("camilo@petcat.test");
    const patitas = await idNegocio(NEGOCIOS[0]);
    const deOtro = (await api(await login("propietario@petcat.test")).get(`/negocios/${patitas}/clientes/${camilo}/notas`)).body;
    expect(deOtro.data).toEqual([]);
  });

  it("invitación a reseñar pendiente para la consulta de Mía de hoy, que ya se puede reseñar", async () => {
    const mia = await idMascota("camilo@petcat.test", "Mía");
    const [[invitacion]] = await pool.query(
      `SELECT r.estado, r.fecha_programada, c.id_cita FROM recordatorios r JOIN citas c ON c.id_cita = r.id_cita
       WHERE r.tipo = 'resena_invitacion' AND c.id_mascota = ?`,
      [mia]
    );
    expect(invitacion).toMatchObject({ estado: "pendiente", fecha_programada: `${hoyISO()} 10:45:00` });
    const cita = (await api(await login("camilo@petcat.test")).get(`/citas/${invitacion.id_cita}`)).body.data;
    expect(cita.resena).toMatchObject({ puede_resenar: true, id_resena: null });
  });
});
