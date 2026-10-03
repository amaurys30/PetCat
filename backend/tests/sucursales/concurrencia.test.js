import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearNegocio, tokenDe } from "../helpers/factories.js";

const sede = (nombre) => ({ nombre, direccion: "Cra 19 #22-35" });

describe("sucursales simultáneas", () => {
  it("negocios nuevos que crean su primera sede a la vez: todas 201 (no deadlock)", async () => {
    // Bloquear las sucursales del negocio con FOR UPDATE, sin filas todavía, tomaba un gap
    // lock que compartían negocios con ids seguidos y las inserciones terminaban en deadlock.
    for (let ronda = 0; ronda < 6; ronda++) {
      const negocios = [];
      for (let i = 0; i < 4; i++) negocios.push(await crearNegocio());
      const tokens = await Promise.all(negocios.map((n) => tokenDe(n.propietario)));
      const respuestas = await Promise.all(
        negocios.map((n, i) => api(tokens[i]).post(`/negocios/${n.id_negocio}/sucursales`).send(sede("Principal"))),
      );
      expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      expect(respuestas.every((r) => r.body.data.es_principal)).toBe(true);
    }
  });

  it("varias sedes nuevas a la vez en el mismo negocio: respeta el límite y deja una sola principal", async () => {
    const negocio = await crearNegocio(null, { plan: "Pro" });
    const token = await tokenDe(negocio.propietario);
    const respuestas = await Promise.all(
      ["A", "B", "C", "D", "E"].map((n) =>
        api(token).post(`/negocios/${negocio.id_negocio}/sucursales`).send({ ...sede(`Sede ${n}`), es_principal: true }),
      ),
    );
    const estados = respuestas.map((r) => r.status).sort();
    // Pro permite 3 sedes: las demás reciben el 403 del plan, ninguna un 500.
    expect(estados).toEqual([201, 201, 201, 403, 403]);
    const [[{ principales }]] = await pool.query(
      "SELECT SUM(es_principal) AS principales FROM sucursales WHERE id_negocio = ? AND activo = TRUE",
      [negocio.id_negocio],
    );
    expect(Number(principales)).toBe(1);
  });
});
