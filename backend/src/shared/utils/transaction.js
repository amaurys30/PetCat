import { getConnection } from "../../config/db.js";

/**
 * Ejecuta `fn(conn)` dentro de una transacción. Hace commit si termina bien,
 * rollback si lanza un error (que se propaga) y siempre libera la conexión.
 *
 *   const id = await withTransaction(async (conn) => {
 *     const idNegocio = await negocioRepo.create(data, conn);
 *     await suscripcionRepo.createGratuita(idNegocio, conn);
 *     return idNegocio;
 *   });
 *
 * Los repositorios reciben un `conn` opcional y usan `conn ?? pool`, así la
 * misma función sirve dentro y fuera de una transacción.
 */
export const withTransaction = async (fn) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Si la conexión se perdió el rollback también falla; interesa el error original.
    }
    throw err;
  } finally {
    conn.release();
  }
};

export default withTransaction;
