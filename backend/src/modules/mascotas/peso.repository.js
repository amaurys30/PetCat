import db from "../../config/db.js";

// Historial de peso (tabla mascota_pesos, migración 029). Solo SQL.

/**
 * Peso que anota el dueño (al crear o editar la mascota): uno por día. Si ya anotó otro hoy,
 * se reemplaza; el gráfico muestra el último del día.
 */
export const registrarDelDueno = async (id_mascota, peso, fecha, conn) => {
  const [result] = await (conn ?? db).query(
    `UPDATE mascota_pesos SET peso = ?
     WHERE id_mascota = ? AND fecha = ? AND origen = 'dueno'`,
    [peso, id_mascota, fecha]
  );
  if (result.affectedRows > 0) return;
  await (conn ?? db).query(
    "INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen) VALUES (?, ?, ?, 'dueno')",
    [id_mascota, peso, fecha]
  );
};

/** Peso de un registro médico: lo crea o lo actualiza (uno por registro); sin peso, lo quita. */
export const sincronizarDeHistorial = async ({ id_historial, id_mascota, peso, fecha }, conn) => {
  if (peso === null || peso === undefined) {
    await conn.query("DELETE FROM mascota_pesos WHERE id_historial = ?", [id_historial]);
    return;
  }
  await conn.query(
    `INSERT INTO mascota_pesos (id_mascota, peso, fecha, origen, id_historial)
     VALUES (?, ?, ?, 'historial', ?)
     ON DUPLICATE KEY UPDATE peso = VALUES(peso), fecha = VALUES(fecha)`,
    [id_mascota, peso, fecha, id_historial]
  );
};

/** Pesos de la mascota desde `desde` ("YYYY-MM-DD"), del más antiguo al más reciente. */
export const findDesde = async (id_mascota, desde) => {
  const [rows] = await db.query(
    `SELECT fecha, peso, origen
     FROM mascota_pesos
     WHERE id_mascota = ? AND fecha >= ?
     ORDER BY fecha, id_peso`,
    [id_mascota, desde]
  );
  return rows.map((r) => ({ fecha: r.fecha, peso: Number(r.peso), origen: r.origen }));
};
