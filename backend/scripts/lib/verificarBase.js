import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const PETCAT_SQL = new URL("../../../database/petcat.sql", import.meta.url);

/** Formato del número del Pasaporte PetCat (migración 030). */
export const FORMATO_PASAPORTE = /^PC-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Funciones, procedimientos y triggers que define database/petcat.sql (la fuente de verdad):
 * así la lista no se desactualiza cuando una migración agrega uno.
 */
export const objetosEsperados = (sql = readFileSync(PETCAT_SQL, "utf8")) => {
  const objetos = { FUNCTION: [], PROCEDURE: [], TRIGGER: [] };
  for (const [, tipo, nombre] of sql.matchAll(/^\s*CREATE\s+(FUNCTION|PROCEDURE|TRIGGER)\s+`?(\w+)`?/gim)) {
    objetos[tipo.toUpperCase()].push(nombre);
  }
  return objetos;
};

const NOMBRES = { FUNCTION: "la función", PROCEDURE: "el procedimiento", TRIGGER: "el trigger" };

/**
 * Comprueba que la base (la de `conn`) tiene todo lo que no viaja en un volcado sin
 * `--routines` y que se puede crear una mascota (el trigger le asigna su número de pasaporte).
 * La mascota de prueba y su dueño se crean en una transacción que se revierte.
 * Devuelve { problemas: string[], codigoDePrueba }.
 */
export const verificarBase = async (conn) => {
  const problemas = [];
  const esperados = objetosEsperados();

  const [rutinas] = await conn.query(
    "SELECT ROUTINE_TYPE AS tipo, ROUTINE_NAME AS nombre FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()"
  );
  const [triggers] = await conn.query(
    "SELECT 'TRIGGER' AS tipo, TRIGGER_NAME AS nombre FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()"
  );
  const existentes = new Set([...rutinas, ...triggers].map((o) => `${o.tipo}:${o.nombre}`));
  for (const [tipo, nombres] of Object.entries(esperados)) {
    for (const nombre of nombres) {
      if (!existentes.has(`${tipo}:${nombre}`)) problemas.push(`Falta ${NOMBRES[tipo]} ${nombre}`);
    }
  }

  let codigoDePrueba = null;
  await conn.beginTransaction();
  try {
    const [usuario] = await conn.query(
      "INSERT INTO usuarios (nombre, apellido, email, password_hash) VALUES ('Verificación', 'PetCat', ?, '-')",
      [`verificacion-${randomUUID()}@petcat.invalid`]
    );
    const [mascota] = await conn.query(
      "INSERT INTO mascotas (id_usuario, nombre, especie) VALUES (?, 'Verificación', 'otro')",
      [usuario.insertId]
    );
    const [[fila]] = await conn.query("SELECT codigo_pasaporte FROM mascotas WHERE id_mascota = ?", [mascota.insertId]);
    codigoDePrueba = fila.codigo_pasaporte;
    if (!FORMATO_PASAPORTE.test(codigoDePrueba ?? "")) {
      problemas.push(`La mascota de prueba recibió un número de pasaporte inválido: ${codigoDePrueba}`);
    }
  } catch (err) {
    problemas.push(`No se pudo crear una mascota de prueba: ${err.message}`);
  } finally {
    await conn.rollback();
  }

  return { problemas, codigoDePrueba };
};
