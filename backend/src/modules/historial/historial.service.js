import * as historialRepo from "./historial.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import { accesoDueno, accesoNegocio } from "../salud/salud.acceso.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { toNumber } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const invalido = (errors) => ApiError.unprocessable("Datos inválidos", errors);

/**
 * Formato de un registro. `notas_internas` solo para el negocio que lo creó; en el
 * panel, `es_propio` indica si lo creó el negocio que consulta.
 */
export const formatRegistro = (row, contexto) => {
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
    archivos: typeof row.archivos_json === "string" ? JSON.parse(row.archivos_json) : (row.archivos_json ?? []),
    negocio: row.id_negocio ? { id_negocio: row.id_negocio, nombre: row.negocio_nombre } : null,
    empleado: row.id_empleado
      ? { id_empleado: row.id_empleado, nombre: row.empleado_nombre, apellido: row.empleado_apellido }
      : null,
    ...(contexto.tipo === "negocio" && { es_propio: propio }),
    ...(propio && { notas_internas: row.notas_internas }),
    fecha_creacion: row.fecha_creacion,
  };
};

/** Negocio cuyo historial clínico se ve en ese contexto: undefined = todos. */
const soloNegocioDe = (contexto) => (contexto.tipo === "negocio" && !contexto.compartir ? contexto.id_negocio : undefined);

const pagina = async ({ mascota, contexto }, { page, limit, ...filtros }) => {
  const { rows, total } = await historialRepo.findPage(mascota.id_mascota, {
    ...filtros,
    soloNegocio: soloNegocioDe(contexto),
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: rows.map((row) => formatRegistro(row, contexto)), meta: buildMeta(total, page, limit) };
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
 * Crea un registro del negocio para una mascota con cita válida. `id_cita` debe ser
 * del negocio, de esa mascota y no estar cancelada ni reprogramada. `id_empleado`
 * por defecto es el perfil de empleado de quien registra (si lo tiene). Fecha por defecto hoy.
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
    if (id_empleado === undefined) {
      id_empleado =
        acceso.id_empleado ??
        (await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio, conn))?.id_empleado ??
        null;
    } else if (id_empleado !== null && !(await historialRepo.empleadoActivoDelNegocio(id_empleado, negocio.id_negocio, conn))) {
      errors.id_empleado = "No es un empleado activo del negocio";
    }
    if (Object.keys(errors).length > 0) throw invalido(errors);

    const id = await historialRepo.create({ ...data, fecha, id_empleado, id_negocio: negocio.id_negocio }, conn);
    await actualizarPesoSiEsElUltimo(data.id_mascota, id, fecha, data.peso_registro, conn);
    return id;
  });
  return formatRegistro(await historialRepo.findById(id_historial), { tipo: "negocio", id_negocio: negocio.id_negocio });
};

/**
 * Edita un registro. Solo el negocio que lo creó (authorize lo resuelve por
 * id_historial). Las fechas se validan contra los valores actuales.
 */
export const actualizarRegistro = async (id_historial, negocio, data) => {
  // La mascota de un registro no cambia: se busca fuera de la transacción para no fijar su foto.
  const { id_mascota } = await historialRepo.findById(id_historial);
  await withTransaction(async (conn) => {
    // Bloqueos antes de leer, en el orden de toda la salud de la mascota: mascota y luego registro.
    await accesoNegocio(negocio.id_negocio, id_mascota, { conn, forUpdate: true });
    await historialRepo.lockRegistro(id_historial, conn);
    const actual = await historialRepo.findById(id_historial, conn);
    const fecha = data.fecha ?? actual.fecha;
    verificarFechas({ fecha, proximo_control: data.proximo_control !== undefined ? data.proximo_control : actual.proximo_control });
    if (data.id_empleado && !(await historialRepo.empleadoActivoDelNegocio(data.id_empleado, negocio.id_negocio, conn))) {
      throw invalido({ id_empleado: "No es un empleado activo del negocio" });
    }
    await historialRepo.update(id_historial, data, conn);
    const peso = data.peso_registro !== undefined ? data.peso_registro : toNumber(actual.peso_registro);
    await actualizarPesoSiEsElUltimo(actual.id_mascota, id_historial, fecha, peso, conn);
  });
  return formatRegistro(await historialRepo.findById(id_historial), { tipo: "negocio", id_negocio: negocio.id_negocio });
};
