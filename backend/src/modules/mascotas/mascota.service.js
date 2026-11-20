import * as mascotaRepo from "./mascota.repository.js";
import * as pesoRepo from "./peso.repository.js";
import { resumenesDeMascotas } from "../salud/salud.lote.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { castFields } from "../../shared/utils/format.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { conMiniaturas } from "../../shared/utils/storage.js";
import { quitarImagen, reemplazarImagen } from "../archivos/archivo.service.js";

export const formatMascota = (mascota) => {
  if (!mascota) return mascota;
  // eslint-disable-next-line no-unused-vars
  const { activo, ...datos } = castFields(mascota, {
    bools: ["esterilizado", "tiene_alergias", "fallecido", "compartir_historial"],
    numbers: ["peso", "edad_meses"],
  });
  return conMiniaturas(datos);
};

/**
 * Mascota activa del usuario. 404 si no existe o se eliminó; 403 si es de otro
 * usuario (la mascota pertenece a su dueño; los negocios la ven por sus citas).
 */
const findPropia = async (id_usuario, id_mascota, opciones) => {
  const mascota = await mascotaRepo.findById(id_mascota, opciones);
  if (!mascota?.activo) throw ApiError.notFound("Mascota no encontrada");
  if (mascota.id_usuario !== id_usuario) throw ApiError.forbidden("No tienes acceso a esta mascota");
  return mascota;
};

const conflictoCitasFuturas = async (id_mascota, conn, accion) => {
  if ((await mascotaRepo.countCitasFuturasActivas(id_mascota, conn)) > 0) {
    throw ApiError.conflict(`La mascota tiene citas pendientes o confirmadas: cancélalas antes de ${accion}`);
  }
};

/**
 * Foto de la mascota: solo el dueño. Se comprueba antes de subir (sin tocar Cloudinary
 * si no es suya) y otra vez dentro de la transacción, con la mascota bloqueada.
 * Una mascota fallecida conserva y puede cambiar su foto.
 */
const fotoDeMascota = (id_usuario, id_mascota) => ({
  entidad: "mascota_foto",
  id_entidad: id_mascota,
  id_usuario,
  bloquear: async (conn) => (await findPropia(id_usuario, id_mascota, { conn, forUpdate: true })).foto_url,
  guardarUrl: (conn, url) => mascotaRepo.setFoto(id_mascota, url, conn),
});

export const subirFoto = async (id_usuario, id_mascota, archivo) => {
  await findPropia(id_usuario, id_mascota);
  await reemplazarImagen({ ...fotoDeMascota(id_usuario, id_mascota), archivo });
  return getMascota(id_usuario, id_mascota);
};

export const eliminarFoto = async (id_usuario, id_mascota) => {
  await quitarImagen({ ...fotoDeMascota(id_usuario, id_mascota), sinImagen: "La mascota no tiene foto" });
  return getMascota(id_usuario, id_mascota);
};

/**
 * Con `incluir: "resumen"`, cada mascota trae su resumen de salud, calculado en lote para
 * todas. Estas rutas son solo del dueño (findPropia o sus propias mascotas): un negocio
 * nunca recibe el resumen, que incluye citas de otros negocios.
 */
const conResumen = async (mascotas, incluir) => {
  const formateadas = mascotas.map(formatMascota);
  if (incluir !== "resumen") return formateadas;
  const resumenes = await resumenesDeMascotas(mascotas);
  return formateadas.map((m) => ({ ...m, resumen: resumenes.get(m.id_mascota) }));
};

export const getMisMascotas = async (id_usuario, { incluir } = {}) =>
  conResumen(await mascotaRepo.findActivasByUsuario(id_usuario), incluir);

export const getMascota = async (id_usuario, id_mascota, { incluir } = {}) =>
  (await conResumen([await findPropia(id_usuario, id_mascota)], incluir))[0];

/** Con peso, queda como primer punto de su historial de peso (anotado por el dueño, hoy). */
export const createMascota = async (id_usuario, data) => {
  const id_mascota = await withTransaction(async (conn) => {
    const id = await mascotaRepo.create(id_usuario, data, conn);
    if (data.peso !== undefined && data.peso !== null) await pesoRepo.registrarDelDueno(id, data.peso, hoyISO(), conn);
    return id;
  });
  return formatMascota(await mascotaRepo.findById(id_mascota));
};

const restarMeses = (fechaISO, meses) => {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);
  fecha.setUTCMonth(fecha.getUTCMonth() - meses);
  return fecha.toISOString().slice(0, 10);
};

/** Historial de peso de una mascota propia: los últimos `meses`, del más antiguo al más reciente. */
export const getPesos = async (id_usuario, id_mascota, { meses }) => {
  const mascota = await findPropia(id_usuario, id_mascota);
  const puntos = await pesoRepo.findDesde(id_mascota, restarMeses(hoyISO(), meses));
  return { peso_actual: mascota.peso === null ? null : Number(mascota.peso), puntos };
};

/**
 * Cambios del fallecimiento a partir de la mascota actual y del body:
 * - `fallecido: true`: la fecha es la enviada, la que ya tenía o hoy.
 * - `fallecido: false`: se borra la fecha (no se puede enviar una fecha con false).
 * - Solo la fecha: exige que la mascota ya esté marcada como fallecida, y no se vacía con null.
 * La fecha de fallecimiento no puede ser anterior a la de nacimiento.
 */
const resolverFallecimiento = (actual, data) => {
  const cambios = { ...data };

  if (data.fallecido === true) {
    cambios.fecha_fallecimiento = data.fecha_fallecimiento ?? actual.fecha_fallecimiento ?? hoyISO();
  } else if (data.fallecido === false) {
    if (data.fecha_fallecimiento) {
      throw ApiError.unprocessable("Datos inválidos", {
        fecha_fallecimiento: "No se envía si la mascota no falleció",
      });
    }
    cambios.fecha_fallecimiento = null;
  } else if (data.fecha_fallecimiento && !actual.fallecido) {
    throw ApiError.unprocessable("Datos inválidos", {
      fecha_fallecimiento: "Marca la mascota como fallecida (fallecido: true)",
    });
  } else if (data.fecha_fallecimiento === null && actual.fallecido) {
    throw ApiError.unprocessable("Datos inválidos", {
      fecha_fallecimiento: "Una mascota fallecida necesita la fecha: corrígela o envía fallecido: false",
    });
  }

  const nacimiento = "fecha_nacimiento" in data ? data.fecha_nacimiento : actual.fecha_nacimiento;
  const fallecimiento = "fecha_fallecimiento" in cambios ? cambios.fecha_fallecimiento : actual.fecha_fallecimiento;
  if (nacimiento && fallecimiento && fallecimiento < nacimiento) {
    throw ApiError.unprocessable("Datos inválidos", {
      fecha_fallecimiento: "No puede ser anterior a la fecha de nacimiento",
    });
  }
  return cambios;
};

/** Registrar el fallecimiento da 409 si la mascota tiene citas futuras pendientes o confirmadas. */
export const updateMascota = async (id_usuario, id_mascota, data) => {
  await withTransaction(async (conn) => {
    const actual = await findPropia(id_usuario, id_mascota, { conn, forUpdate: true });
    const cambios = resolverFallecimiento(actual, data);
    if (cambios.fallecido === true && !actual.fallecido) {
      await conflictoCitasFuturas(id_mascota, conn, "registrar el fallecimiento");
    }
    await mascotaRepo.update(id_mascota, cambios, conn);
    // Un peso nuevo del dueño queda en el historial de peso (uno por día; vaciarlo no borra el historial).
    if (cambios.peso !== undefined && cambios.peso !== null && Number(cambios.peso) !== Number(actual.peso)) {
      await pesoRepo.registrarDelDueno(id_mascota, cambios.peso, hoyISO(), conn);
    }
  });
  return formatMascota(await mascotaRepo.findById(id_mascota));
};

/** Borrado lógico. 409 si tiene citas futuras pendientes o confirmadas. */
export const deleteMascota = async (id_usuario, id_mascota) => {
  await withTransaction(async (conn) => {
    await findPropia(id_usuario, id_mascota, { conn, forUpdate: true });
    await conflictoCitasFuturas(id_mascota, conn, "eliminarla");
    await mascotaRepo.softDelete(id_mascota, conn);
  });
};
