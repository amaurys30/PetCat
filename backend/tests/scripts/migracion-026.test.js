import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { crearNegocio, crearRol } from "../helpers/factories.js";

// Solo el UPDATE de los roles propios: el resto ya está en petcat.sql, con el que se crea la base de los tests.
const sql = readFileSync(new URL("../../../database/migrations/026_citas_ver_todas_y_creador_historial.sql", import.meta.url), "utf8");
const inicio = sql.indexOf("-- Roles propios con citas.ver");
const actualizar = sql.slice(inicio, sql.indexOf("ALTER TABLE", inicio));

const permisosDe = async (rol) => {
  const [[row]] = await pool.query("SELECT permisos_json FROM roles WHERE id_rol = ?", [rol.id_rol]);
  return typeof row.permisos_json === "string" ? JSON.parse(row.permisos_json) : row.permisos_json;
};

describe("migración 026: citas.ver_todas en los roles propios", () => {
  it("se agrega a los roles propios con citas.ver, una sola vez y sin tocar sus demás permisos", async () => {
    const negocio = await crearNegocio();
    const conVer = await crearRol(negocio, { citas: ["ver", "editar"], clientes: ["ver"] });
    const sinVer = await crearRol(negocio, { citas: ["crear"], inventario: ["ver"] });
    const sinCitas = await crearRol(negocio, { clientes: ["ver"] });
    const yaLaTiene = await crearRol(negocio, { citas: ["ver", "ver_todas"] });

    await pool.query(actualizar);
    await pool.query(actualizar);

    expect(await permisosDe(conVer)).toEqual({ citas: ["ver", "editar", "ver_todas"], clientes: ["ver"] });
    expect(await permisosDe(sinVer)).toEqual({ citas: ["crear"], inventario: ["ver"] });
    expect(await permisosDe(sinCitas)).toEqual({ clientes: ["ver"] });
    expect(await permisosDe(yaLaTiene)).toEqual({ citas: ["ver", "ver_todas"] });
  });

  it("roles del sistema: Administrador y Recepcionista ven todas; solo el Administrador asigna profesional", async () => {
    const [rows] = await pool.query("SELECT nombre, permisos_json FROM roles WHERE es_sistema = TRUE");
    const roles = Object.fromEntries(
      rows.map((r) => [r.nombre, typeof r.permisos_json === "string" ? JSON.parse(r.permisos_json) : r.permisos_json])
    );
    expect(roles.Administrador.citas).toContain("ver_todas");
    expect(roles.Recepcionista.citas).toContain("ver_todas");
    expect(roles.Veterinario.citas).not.toContain("ver_todas");
    expect(roles.Administrador.historial_medico).toContain("asignar_profesional");
    expect(roles.Veterinario.historial_medico).not.toContain("asignar_profesional");
    expect(roles.Recepcionista.historial_medico ?? []).not.toContain("asignar_profesional");
  });
});
