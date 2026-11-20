import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { pool } from "../../src/config/db.js";
import { runSqlFile } from "../../scripts/lib/sqlRunner.js";
import { api } from "../helpers/api.js";
import { crearMascota, crearUsuario, tokenDe } from "../helpers/factories.js";

const MIGRACION_030 = fileURLToPath(new URL("../../../database/migrations/030_codigo_pasaporte.sql", import.meta.url));

// PC-XXXX-XXXX con el alfabeto de 30 (sin 0/O, 1/I/L ni U).
const FORMATO = /^PC-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;

/** Código válido al azar, para no chocar con los de otras pruebas (la base es compartida). */
const codigoAlAzar = () => {
  const alfabeto = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const parte = () => Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
  return `PC-${parte()}-${parte()}`;
};

describe("número del Pasaporte PetCat (codigo_pasaporte)", () => {
  it("la API lo asigna al crear la mascota, con el formato, y es el mismo en la lista y en el detalle", async () => {
    const token = await tokenDe(await crearUsuario());
    const creada = await api(token).post("/mascotas").send({ nombre: "Max", especie: "perro" });
    expect(creada.status).toBe(201);
    const { id_mascota, codigo_pasaporte } = creada.body.data;
    expect(codigo_pasaporte).toMatch(FORMATO);

    const lista = await api(token).get("/mascotas?incluir=resumen");
    expect(lista.body.data.find((m) => m.id_mascota === id_mascota).codigo_pasaporte).toBe(codigo_pasaporte);
    const detalle = await api(token).get(`/mascotas/${id_mascota}`);
    expect(detalle.body.data.codigo_pasaporte).toBe(codigo_pasaporte);
  });

  it("es estable: no cambia al editar, y no se puede enviar (422)", async () => {
    const token = await tokenDe(await crearUsuario());
    const { id_mascota, codigo_pasaporte } = (await api(token).post("/mascotas").send({ nombre: "Luna", especie: "gato" }))
      .body.data;

    const editada = await api(token).patch(`/mascotas/${id_mascota}`).send({ nombre: "Lunita", peso: 4.2 });
    expect(editada.body.data.codigo_pasaporte).toBe(codigo_pasaporte);

    expect((await api(token).patch(`/mascotas/${id_mascota}`).send({ codigo_pasaporte: codigoAlAzar() })).status).toBe(422);
    expect((await api(token).post("/mascotas").send({ nombre: "Rex", especie: "perro", codigo_pasaporte: codigoAlAzar() })).status).toBe(
      422
    );
  });

  it("no sale del id: mascotas consecutivas tienen códigos distintos, sin orden y sin el id", async () => {
    const dueno = await crearUsuario();
    const mascotas = [];
    for (let i = 0; i < 20; i++) mascotas.push(await crearMascota(dueno));

    const codigos = mascotas.map((m) => m.codigo_pasaporte);
    for (const codigo of codigos) expect(codigo).toMatch(FORMATO);
    expect(new Set(codigos).size).toBe(20);
    // En orden de id, los códigos no quedan ordenados (con 20 al azar es prácticamente imposible).
    expect([...codigos].sort()).not.toEqual(codigos);
    for (const m of mascotas) expect(m.codigo_pasaporte).not.toContain(String(m.id_mascota));
  });

  it("es único: un código repetido no se puede guardar", async () => {
    const dueno = await crearUsuario();
    const primera = await crearMascota(dueno);
    await expect(crearMascota(dueno, { codigo_pasaporte: primera.codigo_pasaporte })).rejects.toMatchObject({
      code: "ER_DUP_ENTRY",
    });
  });

  it("el trigger regenera mientras el código generado ya exista", async () => {
    const dueno = await crearUsuario();
    const ocupado = codigoAlAzar();
    let libre = codigoAlAzar();
    while (libre === ocupado) libre = codigoAlAzar();
    const ocupada = await crearMascota(dueno, { codigo_pasaporte: ocupado });
    const conn = await pool.getConnection();
    try {
      // Versión de prueba: las 3 primeras llamadas de la sesión devuelven el código ocupado.
      await conn.query("DROP FUNCTION fn_codigo_pasaporte");
      await conn.query(
        `CREATE FUNCTION fn_codigo_pasaporte() RETURNS CHAR(12) CHARSET ascii NOT DETERMINISTIC NO SQL
         BEGIN
           SET @llamadas = COALESCE(@llamadas, 0) + 1;
           IF @llamadas <= 3 THEN RETURN @ocupado; END IF;
           RETURN @libre;
         END`
      );
      await conn.query("SET @llamadas = 0, @ocupado = ?, @libre = ?", [ocupado, libre]);
      const [r] = await conn.query("INSERT INTO mascotas (id_usuario, nombre, especie) VALUES (?, 'Nueva', 'gato')", [
        dueno.id_usuario,
      ]);
      const [[{ llamadas }]] = await conn.query("SELECT @llamadas AS llamadas");
      const [[nueva]] = await conn.query("SELECT codigo_pasaporte FROM mascotas WHERE id_mascota = ?", [r.insertId]);
      expect(Number(llamadas)).toBe(4);
      expect(nueva.codigo_pasaporte).toBe(libre);
      expect(ocupada.codigo_pasaporte).toBe(ocupado);
    } finally {
      // La migración 030 es reejecutable: deja la función original.
      await runSqlFile(conn, MIGRACION_030);
      conn.release();
    }
  });
});
