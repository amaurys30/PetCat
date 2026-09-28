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
    expect(filas).toEqual([
      { nombre: "Baño y corte", email: null },
      { nombre: "Consulta general", email: "veterinario@petcat.test" },
      { nombre: "Vacuna antirrábica", email: "veterinario@petcat.test" },
    ]);
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

  it("cuatro negocios de distintos tipos en Sincelejo, con coordenadas y calificación por reseñas", async () => {
    const [filas] = await pool.query(
      "SELECT nombre, tipo, ciudad, latitud, calificacion_promedio, total_resenas FROM negocios WHERE nombre IN (?) ORDER BY id_negocio",
      [NEGOCIOS]
    );
    expect(filas.map((f) => f.tipo)).toEqual(["veterinaria", "peluqueria_canina", "guarderia", "clinica"]);
    expect(filas.every((f) => f.ciudad === "Sincelejo" && f.latitud !== null && f.total_resenas === 1)).toBe(true);
    expect(filas.find((f) => f.tipo === "peluqueria_canina").calificacion_promedio).toBe("4.00");

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
});
