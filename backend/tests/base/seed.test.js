import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { comparePassword } from "../../src/shared/utils/hash.js";
import { api } from "../helpers/api.js";

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

    const [[{ dias }]] = await pool.query(
      "SELECT COUNT(DISTINCT dia_semana) AS dias FROM horarios_negocio WHERE id_sucursal = ?",
      [sucursales[0].id_sucursal]
    );
    expect(dias).toBe(6);
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
});
