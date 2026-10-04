import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { crearNegocio, crearUsuario } from "../helpers/factories.js";

// Solo el UPDATE: el ALTER ya está en petcat.sql, con el que se crea la base de los tests.
const sql = readFileSync(new URL("../../../database/migrations/020_autorizaciones_panel_web.sql", import.meta.url), "utf8");
const actualizar = sql.slice(sql.indexOf("UPDATE autorizaciones_datos"));

describe("migración 020: canal panel_web", () => {
  it("pasa a panel_web solo las filas panel sin negocio registradas por el propio titular", async () => {
    const propio = await crearUsuario();
    const registradoPorNegocio = await crearUsuario();
    const deNegocioBorrado = await crearUsuario();
    const negocio = await crearNegocio();
    const registrador = negocio.propietario.id_usuario;

    const insertar = (id_usuario, id_negocio, id_usuario_registro) =>
      pool.query(
        `INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica)
         VALUES (?, 'panel', ?, ?, '1.0')`,
        [id_usuario, id_negocio, id_usuario_registro]
      );
    await insertar(propio.id_usuario, null, propio.id_usuario);
    await insertar(registradoPorNegocio.id_usuario, negocio.id_negocio, registrador);
    await insertar(deNegocioBorrado.id_usuario, null, registrador);

    await pool.query(actualizar);

    const canalDe = async (usuario) => {
      const [[row]] = await pool.query("SELECT canal FROM autorizaciones_datos WHERE id_usuario = ?", [usuario.id_usuario]);
      return row.canal;
    };
    expect(await canalDe(propio)).toBe("panel_web");
    expect(await canalDe(registradoPorNegocio)).toBe("panel");
    expect(await canalDe(deNegocioBorrado)).toBe("panel");
  });
});
