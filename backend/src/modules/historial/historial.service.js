import * as historialRepo from "./historial.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import { accesoDueno, accesoNegocio } from "../salud/salud.acceso.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { toNumber } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { procesarArchivo } from "../../shared/utils/uploads.js";
import { accesoPermite } from "../../shared/utils/permissions.js";
import {
  archivosActivos,
  archivosActivosDe,
  eliminarArchivos,
  formatArchivoExterno,
  formatArchivoPrivado,
  subirArchivos,
} from "../archivos/archivo.service.js";

const invalido = (errors) => ApiError.unprocessable("Datos inválidos", errors);

const ENTIDAD_ARCHIVO = "historial_archivo";
export const MAX_ARCHIVOS_REGISTRO = 10;

/** URLs externas guardadas antes de la 2.2 en archivos_json (solo lectura). */
const externosDe = (row) =>
  (typeof row.archivos_json === "string" ? JSON.parse(row.archivos_json) : (row.archivos_json ?? [])) ?? [];

/**
 * Formato de un registro. `notas_internas` solo para el negocio que lo creó; en el
 * panel, `es_propio` indica si lo creó el negocio que consulta. `archivos` son las filas
 * activas de la tabla `archivos` (privadas: salen con URL firmada que vence).
 */
export const formatRegistro = (row, contexto, archivos = []) => {
  const propio = contexto.tipo === "negocio" && row.id_negocio === contexto.id_negocio;
  return {
    id_historial: row.id_historial,
    id_mascota: row.id_mascota,
    id_cita: row.id_cita,
    fecha: row.fecha,
    tipo: row.tipo,
    motivo_consulta: row.motivo_consulta,
    diagnostico: row.diagnostico,
    tratamiento: row.tratamiento,
    medicamentos_prescritos: row.medicamentos_prescritos,
    indicaciones: row.indicaciones,
    proximo_control: row.proximo_control,
    peso_registro: toNumber(row.peso_registro),
    temperatura: toNumber(row.temperatura),
    frecuencia_cardiaca: row.frecuencia_cardiaca,
    frecuencia_respiratoria: row.frecuencia_respiratoria,
    archivos: [...externosDe(row).map(formatArchivoExterno), ...archivos.map(formatArchivoPrivado)],
    negocio: row.id_negocio ? { id_negocio: row.id_negocio, nombre: row.negocio_nombre } : null,
    empleado: row.id_empleado
      ? { id_empleado: row.id_empleado, nombre: row.empleado_nombre, apellido: row.empleado_apellido }
      : null,
    ...(contexto.tipo === "negocio" && { es_propio: propio }),
    ...(propio && { notas_internas: row.notas_internas }),
    // Quién lo creó (puede no ser el profesional que atendió). NULL antes de la migración 026.
    ...(propio && {
      registrado_por: row.id_usuario_registro
        ? { id_usuario: row.id_usuario_registro, nombre: row.registro_nombre, apellido: row.registro_apellido }
        : null,
    }),
    fecha_creacion: row.fecha_creacion,
    // Los registros no se borran: la última edición (quién y cuándo) y cuántas hubo.
    edicion: row.fecha_edicion
      ? {
          fecha: row.fecha_edicion,
          usuario: row.id_usuario_edicion
            ? { id_usuario: row.id_usuario_edicion, nombre: row.editor_nombre, apellido: row.editor_apellido }
            : null,
        }
      : null,
    ediciones: Number(row.ediciones ?? 0),
  };
};

/** Registros con sus archivos (una sola consulta para todos). */
const conArchivos = async (rows, contexto) => {
  const archivos = await archivosActivosDe(ENTIDAD_ARCHIVO, rows.map((row) => row.id_historial));
  return rows.map((row) => formatRegistro(row, contexto, archivos[row.id_historial]));
};

/** Un registro completo para el negocio que lo creó (respuesta de crear, editar y archivos). */
const registroDelNegocio = async (id_historial, id_negocio) =>
  (await conArchivos([await historialRepo.findById(id_historial)], { tipo: "negocio", id_negocio }))[0];

/** Negocio cuyo historial clínico se ve en ese contexto: undefined = todos. */
const soloNegocioDe = (contexto) => (contexto.tipo === "negocio" && !contexto.compartir ? contexto.id_negocio : undefined);

const pagina = async ({ mascota, contexto }, { page, limit, ...filtros }) => {
  const { rows, total } = await historialRepo.findPage(mascota.id_mascota, {
    ...filtros,
    soloNegocio: soloNegocioDe(contexto),
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: await conArchivos(rows, contexto), meta: buildMeta(total, page, limit) };
};

/** Historial completo de una mascota propia, sin notas internas. */
export const getHistorialDueno = async (id_usuario, id_mascota, query) =>
  pagina(await accesoDueno(id_usuario, id_mascota), query);

/**
 * Historial para un negocio con cita válida: todo si compartir_historial es TRUE; si
 * no, solo lo que creó ese negocio. Notas internas solo de sus registros.
 */
export const getHistorialNegocio = async (id_negocio, id_mascota, query) =>
  pagina(await accesoNegocio(id_negocio, id_mascota), query);

/** proximo_control no puede ser anterior a la fecha del registro. */
const verificarFechas = ({ fecha, proximo_control }) => {
  if (proximo_control && fecha && proximo_control < fecha) {
    throw invalido({ proximo_control: "No puede ser anterior a la fecha del registro" });
  }
};

/**
 * Si el registro tiene peso y es el más reciente de la mascota (por fecha), el peso
 * de la mascota pasa a ser ese. Requiere la mascota bloqueada.
 */
const actualizarPesoSiEsElUltimo = async (id_mascota, id_historial, fecha, peso, conn) => {
  if (peso === null || peso === undefined) return;
  const ultima = await historialRepo.fechaUltimoPeso(id_mascota, id_historial, conn);
  if (!ultima || fecha >= ultima) await historialRepo.actualizarPesoMascota(id_mascota, peso, conn);
};

/**
 * Registrar a nombre de otro profesional (historial_medico.asignar_profesional; el propietario
 * y el admin de plataforma siempre). Sin el permiso, el profesional es quien registra.
 */
const asignaProfesional = (acceso) => accesoPermite(acceso, "historial_medico", "asignar_profesional");

const SIN_ASIGNAR = "Para registrar a nombre de otro profesional necesitas el permiso de asignar profesional";

/**
 * Crea un registro del negocio para una mascota con cita válida. `id_cita` debe ser
 * del negocio, de esa mascota y no estar cancelada ni reprogramada. `id_empleado`
 * por defecto es el perfil de empleado de quien registra (si lo tiene); sin
 * asignar_profesional es siempre ese perfil (403 con otro). Guarda quién lo creó.
 * Fecha por defecto hoy.
 */
export const crearRegistro = async (negocio, { id_usuario, acceso }, data) => {
  const fecha = data.fecha ?? hoyISO();
  verificarFechas({ ...data, fecha });

  const id_historial = await withTransaction(async (conn) => {
    await accesoNegocio(negocio.id_negocio, data.id_mascota, { conn, forUpdate: true });

    const errors = {};
    if (data.id_cita !== undefined) {
      const cita = await historialRepo.findCitaDelNegocio(data.id_cita, negocio.id_negocio, conn);
      if (!cita || cita.id_mascota !== data.id_mascota || ["cancelada", "reprogramada"].includes(cita.estado)) {
        errors.id_cita = "Debe ser una cita del negocio con esta mascota, no cancelada ni reprogramada";
      }
    }
    let id_empleado = data.id_empleado;
    if (!asignaProfesional(acceso)) {
      if (id_empleado !== undefined && id_empleado !== acceso.id_empleado) throw ApiError.forbidden(SIN_ASIGNAR);
      id_empleado = acceso.id_empleado;
    } else if (id_empleado === undefined) {
      id_empleado =
        acceso.id_empleado ??
        (await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio, conn))?.id_empleado ??
        null;
    } else if (id_empleado !== null && !(await historialRepo.empleadoActivoDelNegocio(id_empleado, negocio.id_negocio, conn))) {
      errors.id_empleado = "No es un empleado activo del negocio";
    }
    if (Object.keys(errors).length > 0) throw invalido(errors);

    const id = await historialRepo.create(
      { ...data, fecha, id_empleado, id_negocio: negocio.id_negocio, id_usuario_registro: id_usuario },
      conn
    );
    await actualizarPesoSiEsElUltimo(data.id_mascota, id, fecha, data.peso_registro, conn);
    return id;
  });
  return registroDelNegocio(id_historial, negocio.id_negocio);
};

// Campos numéricos: MySQL devuelve los DECIMAL como texto ("28.50").
const NUMERICOS = new Set(["peso_registro", "temperatura", "frecuencia_cardiaca", "frecuencia_respiratoria", "id_empleado"]);
const normalizar = (campo, valor) => (NUMERICOS.has(campo) ? toNumber(valor) : (valor ?? null));

/** Valores anteriores de los campos que de verdad cambian: { campo: valor_anterior }. */
const cambiosDe = (actual, data) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([campo, valor]) => normalizar(campo, actual[campo]) !== normalizar(campo, valor))
      .map(([campo]) => [campo, normalizar(campo, actual[campo])])
  );

/**
 * Edita un registro. Solo el negocio que lo creó (authorize lo resuelve por
 * id_historial). Las fechas se validan contra los valores actuales. Si algo cambia, deja
 * constancia de quién, cuándo, qué campos y sus valores anteriores (los registros no se
 * borran); si nada cambia, no hay edición. Cambiar el profesional exige asignar_profesional.
 */
export const actualizarRegistro = async (id_historial, negocio, { id_usuario, acceso }, data) => {
  // La mascota de un registro no cambia: se busca fuera de la transacción para no fijar su foto.
  const { id_mascota } = await historialRepo.findById(id_historial);
  await withTransaction(async (conn) => {
    // Bloqueos antes de leer, en el orden de toda la salud de la mascota: mascota y luego registro.
    await accesoNegocio(negocio.id_negocio, id_mascota, { conn, forUpdate: true });
    await historialRepo.lockRegistro(id_historial, conn);
    const actual = await historialRepo.findById(id_historial, conn);
    const fecha = data.fecha ?? actual.fecha;
    verificarFechas({ fecha, proximo_control: data.proximo_control !== undefined ? data.proximo_control : actual.proximo_control });
    if (data.id_empleado !== undefined && data.id_empleado !== actual.id_empleado && !asignaProfesional(acceso)) {
      throw ApiError.forbidden(SIN_ASIGNAR);
    }
    if (data.id_empleado && !(await historialRepo.empleadoActivoDelNegocio(data.id_empleado, negocio.id_negocio, conn))) {
      throw invalido({ id_empleado: "No es un empleado activo del negocio" });
    }
    const anteriores = cambiosDe(actual, data);
    if (Object.keys(anteriores).length === 0) return;
    await historialRepo.update(id_historial, data, conn);
    await historialRepo.registrarEdicion(id_historial, id_usuario, anteriores, conn);
    const peso = data.peso_registro !== undefined ? data.peso_registro : toNumber(actual.peso_registro);
    await actualizarPesoSiEsElUltimo(actual.id_mascota, id_historial, fecha, peso, conn);
  });
  return registroDelNegocio(id_historial, negocio.id_negocio);
};

// ---------- Archivos del registro (privados) ----------

const verificarCupo = (externos, activos, nuevos) => {
  const total = externos + activos;
  if (total + nuevos > MAX_ARCHIVOS_REGISTRO) {
    throw invalido({
      archivo: `Un registro admite hasta ${MAX_ARCHIVOS_REGISTRO} archivos: tiene ${total} y se enviaron ${nuevos}`,
    });
  }
};

/**
 * Bloquea mascota y registro (el orden de toda la salud de la mascota), con la misma
 * regla de acceso que editar el registro (el negocio que lo creó, con cita válida).
 */
const bloquearRegistro = (id_negocio, id_mascota, id_historial) => async (conn) => {
  await accesoNegocio(id_negocio, id_mascota, { conn, forUpdate: true });
  await historialRepo.lockRegistro(id_historial, conn);
};

/**
 * Agrega archivos (imágenes o PDF) a un registro del negocio: hasta 5 por envío y 10 por
 * registro. Se guardan privados; el registro los devuelve con URLs firmadas que vencen.
 * El cupo se comprueba antes de subir y otra vez con el registro bloqueado.
 */
export const agregarArchivos = async (id_historial, negocio, id_usuario, archivos) => {
  const registro = await historialRepo.findById(id_historial);
  const externos = externosDe(registro).length;
  verificarCupo(externos, (await archivosActivos(ENTIDAD_ARCHIVO, id_historial)).length, archivos.length);

  const procesados = [];
  for (const archivo of archivos) {
    try {
      procesados.push(await procesarArchivo(archivo, ENTIDAD_ARCHIVO));
    } catch (err) {
      // Con varios archivos, el error dice cuál falló.
      if (err.errors?.archivo && archivos.length > 1) err.errors.archivo = `${archivo.originalname}: ${err.errors.archivo}`;
      throw err;
    }
  }

  const bloquear = bloquearRegistro(negocio.id_negocio, registro.id_mascota, id_historial);
  await subirArchivos({
    entidad: ENTIDAD_ARCHIVO,
    id_entidad: id_historial,
    procesados,
    id_usuario,
    bloquear: async (conn) => {
      await bloquear(conn);
      // Otro envío pudo agregar archivos mientras se subían estos (los nuevos se insertan después de bloquear).
      const activos = (await archivosActivos(ENTIDAD_ARCHIVO, id_historial, conn)).length;
      verificarCupo(externos, activos, procesados.length);
    },
  });
  return registroDelNegocio(id_historial, negocio.id_negocio);
};

/** Elimina un archivo del registro; 404 si no es un archivo activo de ese registro. */
export const eliminarArchivo = async (id_historial, id_archivo, negocio, id_usuario) => {
  const { id_mascota } = await historialRepo.findById(id_historial);
  const eliminados = await eliminarArchivos({
    entidad: ENTIDAD_ARCHIVO,
    id_entidad: id_historial,
    ids: [id_archivo],
    id_usuario,
    bloquear: bloquearRegistro(negocio.id_negocio, id_mascota, id_historial),
  });
  if (eliminados.length === 0) throw ApiError.notFound("Archivo no encontrado en este registro");
  return registroDelNegocio(id_historial, negocio.id_negocio);
};
