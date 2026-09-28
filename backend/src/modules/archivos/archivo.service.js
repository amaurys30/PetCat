import * as archivoRepo from "./archivo.repository.js";
import { storage } from "../../shared/utils/storage.js";
import { DESTINOS } from "../../shared/utils/uploads.js";
import { withTransaction } from "../../shared/utils/transaction.js";

/**
 * Ciclo de vida de los archivos subidos. El registro que los usa (mascota, vacuna,
 * historial...) se bloquea y se actualiza dentro de la misma transacción que la tabla
 * `archivos`; Cloudinary queda fuera de la transacción:
 * - se sube antes; si la transacción falla, se borra lo subido (compensación);
 * - lo reemplazado o eliminado se marca `por_eliminar` y se borra después del commit;
 *   si ese borrado falla queda `por_eliminar` y lo reintenta `reintentarEliminaciones` (2.4).
 */

// Carpeta en Cloudinary (dentro de CLOUDINARY_FOLDER) de cada entidad.
const CARPETAS = {
  usuario_foto: "usuarios",
  mascota_foto: "mascotas",
  empleado_foto: "empleados",
  negocio_logo: "negocios",
  negocio_banner: "negocios",
  vacuna_comprobante: "vacunas",
  historial_archivo: "historial",
};

/** Borra de Cloudinary y marca `eliminado`; si falla, suma un intento y queda `por_eliminar`. Nunca lanza. */
export const eliminarDelAlmacenamiento = async (filas) => {
  for (const fila of filas) {
    try {
      await storage.eliminar(fila);
      await archivoRepo.marcarEliminado(fila.id_archivo);
    } catch (err) {
      console.error(`[archivos] No se pudo eliminar ${fila.public_id} (queda por_eliminar):`, err.message);
      await archivoRepo.sumarIntentoEliminar(fila.id_archivo).catch(() => {});
    }
  }
};

/**
 * Compensación cuando la transacción falla después de subir: se borra lo subido y, si
 * tampoco se puede, se registra `por_eliminar` para que el reintento lo encuentre.
 */
const descartarSubidos = async (subidos, { entidad, id_entidad, id_usuario }) => {
  for (const subido of subidos) {
    try {
      await storage.eliminar(subido);
    } catch (err) {
      console.error(`[archivos] No se pudo descartar ${subido.public_id}:`, err.message);
      await archivoRepo
        .create({ ...subido, entidad, id_entidad, estado: "por_eliminar", id_usuario_subio: id_usuario })
        .catch(() => {});
    }
  }
};

/**
 * Sube los archivos procesados (`procesarArchivo`) de un registro y los registra.
 * @param {object} p
 * @param {string} p.entidad        Valor de archivos.entidad (p. ej. "mascota_foto")
 * @param {number} p.id_entidad
 * @param {object[]} p.procesados
 * @param {number} p.id_usuario     Quién sube
 * @param {boolean} [p.reemplazar]  Los archivos activos anteriores del registro pasan a por_eliminar
 * @param {(conn) => Promise<void>} p.bloquear  Bloquea (FOR UPDATE por clave primaria) y valida el registro;
 *   va primero en la transacción y serializa los cambios de sus archivos
 * @param {(conn, archivos) => Promise<void>} [p.actualizar]  Actualiza el registro con los archivos nuevos
 * @returns {Promise<object[]>} Filas de `archivos` creadas, con `url` (media) si son públicas
 */
export const subirArchivos = async ({ entidad, id_entidad, procesados, id_usuario, reemplazar = false, bloquear, actualizar }) => {
  const destino = DESTINOS[entidad];
  const carpeta = `${CARPETAS[entidad]}/${id_entidad}`;
  const meta = { entidad, id_entidad, id_usuario };

  // Subidas en paralelo; si alguna falla se descartan las que sí subieron.
  const resultados = await Promise.allSettled(
    procesados.map((p) =>
      storage.subir(p.buffer, { carpeta, privado: destino.privado, tipoRecurso: p.tipoRecurso, formato: p.formato })
    )
  );
  const subidos = resultados.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const fallo = resultados.find((r) => r.status === "rejected");
  if (fallo) {
    await descartarSubidos(subidos, meta);
    throw fallo.reason;
  }

  let reemplazados = [];
  let filas;
  try {
    filas = await withTransaction(async (conn) => {
      await bloquear(conn);
      const nuevas = [];
      for (const [i, subido] of subidos.entries()) {
        const fila = {
          ...subido,
          ancho: procesados[i].ancho,
          alto: procesados[i].alto,
          nombre_original: procesados[i].nombre_original,
          entidad,
          id_entidad,
          id_usuario_subio: id_usuario,
        };
        const id_archivo = await archivoRepo.create(fila, conn);
        nuevas.push({
          ...fila,
          id_archivo,
          estado: "activo",
          url: destino.privado ? null : storage.urlPublica(subido.public_id, "media"),
        });
      }
      if (reemplazar) {
        reemplazados = await archivoRepo.marcarPorEliminar(
          { entidad, id_entidad, excepto: nuevas.map((f) => f.id_archivo), id_usuario },
          conn
        );
      }
      if (actualizar) await actualizar(conn, nuevas);
      return nuevas;
    });
  } catch (err) {
    await descartarSubidos(subidos, meta);
    throw err;
  }

  await eliminarDelAlmacenamiento(reemplazados);
  return filas;
};

/**
 * Elimina archivos activos de un registro: todos o solo `ids`. En la transacción bloquea
 * el registro (`bloquear`, obligatorio como en subirArchivos), marca los archivos
 * `por_eliminar` y actualiza el registro; después del
 * commit los borra de Cloudinary. Devuelve las filas marcadas (vacío si no había).
 */
export const eliminarArchivos = async ({ entidad, id_entidad, ids, id_usuario, bloquear, actualizar }) => {
  const marcados = await withTransaction(async (conn) => {
    await bloquear(conn);
    const filas = await archivoRepo.marcarPorEliminar({ entidad, id_entidad, ids, id_usuario }, conn);
    if (actualizar) await actualizar(conn, filas);
    return filas;
  });
  await eliminarDelAlmacenamiento(marcados);
  return marcados;
};

/**
 * Reintenta borrar en Cloudinary los archivos `por_eliminar` (job de la 2.4). Deja de
 * intentar un archivo después de `maxIntentos` fallos. Devuelve cuántos procesó.
 */
export const reintentarEliminaciones = async ({ limite = 100, maxIntentos = 10 } = {}) => {
  const pendientes = await archivoRepo.findPorEliminar({ limite, maxIntentos });
  await eliminarDelAlmacenamiento(pendientes);
  return pendientes.length;
};

// ---------- Formato para las respuestas ----------

/** URLs de una imagen pública guardada en una columna *_url: `{ url, miniatura_url }`. */
export const variantesImagen = (url) => ({
  url: url ?? null,
  miniatura_url: storage.varianteDeUrl(url ?? null, "miniatura"),
});

/**
 * Archivo privado para quien puede ver el registro, con URL firmada que vence:
 * `{ id_archivo, tipo, nombre, bytes, url, url_expira_en }`.
 */
export const formatArchivoPrivado = (fila) => {
  const { url, expira_en } = storage.urlFirmada(fila);
  return {
    id_archivo: fila.id_archivo,
    tipo: fila.tipo_recurso === "raw" ? "pdf" : "imagen",
    nombre: fila.nombre_original,
    bytes: fila.bytes,
    url,
    url_expira_en: expira_en,
  };
};
