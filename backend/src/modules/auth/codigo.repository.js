import pool from "../../config/db.js";

// Códigos de 6 dígitos de los correos (tabla codigos_correo). Solo SQL.

/** Bloquea la fila del usuario: serializa las emisiones de una misma cuenta (límites por correo). */
export const lockUsuario = async (id_usuario, conn) => {
  await conn.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ? FOR UPDATE", [id_usuario]);
};

/** Códigos emitidos a la cuenta en el último minuto y en la última hora (de un tipo). */
export const contarRecientes = async (id_usuario, tipo, conn) => {
  const [[row]] = await (conn ?? pool).query(
    `SELECT COALESCE(SUM(fecha_creacion > NOW() - INTERVAL 1 MINUTE), 0) AS ultimo_minuto,
            COUNT(*) AS ultima_hora
     FROM codigos_correo
     WHERE id_usuario = ? AND tipo = ? AND fecha_creacion > NOW() - INTERVAL 1 HOUR`,
    [id_usuario, tipo]
  );
  return { ultimoMinuto: Number(row.ultimo_minuto), ultimaHora: Number(row.ultima_hora) };
};

export const crear = async ({ id_usuario, tipo, codigo_hash, minutos }, conn) => {
  await (conn ?? pool).query(
    `INSERT INTO codigos_correo (id_usuario, tipo, codigo_hash, expira)
     VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
    [id_usuario, tipo, codigo_hash, minutos]
  );
};

/** El código vigente (sin cerrar y sin vencer) más reciente del usuario, bloqueado para actualizarlo. */
export const findVigenteForUpdate = async (id_usuario, tipo, conn) => {
  const [rows] = await conn.query(
    `SELECT id_codigo, codigo_hash, intentos
     FROM codigos_correo
     WHERE id_usuario = ? AND tipo = ? AND cerrado_en IS NULL AND expira > NOW()
     ORDER BY id_codigo DESC
     LIMIT 1
     FOR UPDATE`,
    [id_usuario, tipo]
  );
  return rows[0];
};

/**
 * Suma un intento fallido; al llegar a `maximo` cierra el código (motivo `intentos`).
 * MySQL evalúa las asignaciones de izquierda a derecha: los IF ya ven `intentos` sumado.
 */
export const sumarIntento = async (id_codigo, maximo, conn) => {
  await conn.query(
    `UPDATE codigos_correo
     SET intentos = intentos + 1,
         cerrado_en = IF(intentos >= ?, NOW(), cerrado_en),
         motivo_cierre = IF(intentos >= ?, 'intentos', motivo_cierre)
     WHERE id_codigo = ?`,
    [maximo, maximo, id_codigo]
  );
};

export const cerrar = async (id_codigo, motivo, conn) => {
  await (conn ?? pool).query(
    "UPDATE codigos_correo SET cerrado_en = NOW(), motivo_cierre = ? WHERE id_codigo = ?",
    [motivo, id_codigo]
  );
};

/** Cierra los códigos abiertos del usuario; con `tipo` null, los de los dos tipos. */
export const cerrarAbiertos = async (id_usuario, tipo, motivo, conn) => {
  await (conn ?? pool).query(
    `UPDATE codigos_correo SET cerrado_en = NOW(), motivo_cierre = ?
     WHERE id_usuario = ? AND cerrado_en IS NULL${tipo ? " AND tipo = ?" : ""}`,
    tipo ? [motivo, id_usuario, tipo] : [motivo, id_usuario]
  );
};
