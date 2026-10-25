import { pool } from "../../config/db.js";

/**
 * Auditoría de operaciones críticas (`auditoria_global`): quién, qué tabla y registro, el
 * antes y el después, IP y navegador. Va en la misma transacción del cambio.
 */
export const registrar = async (
  { id_usuario, tabla, operacion, registro_id = null, antes = null, despues = null, ip = null, user_agent = null },
  conn
) => {
  await (conn ?? pool).query(
    `INSERT INTO auditoria_global (id_usuario, tabla_afectada, operacion, registro_id, datos_antes_json,
                                   datos_despues_json, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id_usuario,
      tabla,
      operacion,
      registro_id,
      antes === null ? null : JSON.stringify(antes),
      despues === null ? null : JSON.stringify(despues),
      ip,
      user_agent ? String(user_agent).slice(0, 300) : null,
    ]
  );
};
