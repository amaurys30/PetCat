import * as vacunaRepo from "./vacuna.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import * as historialRepo from "../historial/historial.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { calcularEstados } from "./vacuna.calculo.js";
import { CAMPOS_SOLO_NEGOCIO } from "./vacuna.schemas.js";
import { accesoDueno, accesoNegocio } from "../salud/salud.acceso.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const invalido = (errors) => ApiError.unprocessable("Datos inválidos", errors);

export const diasAvisoVacuna = () => configuracionRepo.getValor("dias_aviso_vacuna", 30);

/** Formato de una vacuna con su estado calculado. */
const formatVacuna = (row, estado) => ({
  id_vacuna: row.id_vacuna,
  id_mascota: row.id_mascota,
  nombre_vacuna: row.nombre_vacuna,
  enfermedad_objetivo: row.enfermedad_objetivo,
  laboratorio: row.laboratorio,
  lote: row.lote,
  dosis: row.dosis,
  via_administracion: row.via_administracion,
  sitio_aplicacion: row.sitio_aplicacion,
  fecha_aplicacion: row.fecha_aplicacion,
  fecha_proxima: row.fecha_proxima,
  estado,
  // Para que el veterinario distinga lo que registró el dueño de lo que registró un profesional.
  registrada_por: row.registrada_por,
  tiene_comprobante: Boolean(row.comprobante_url),
  comprobante_url: row.comprobante_url,
  notas: row.notas,
  negocio: row.id_negocio ? { id_negocio: row.id_negocio, nombre: row.negocio_nombre } : null,
  empleado: row.id_empleado
    ? { id_empleado: row.id_empleado, nombre: row.empleado_nombre, apellido: row.empleado_apellido }
    : null,
  id_historial_medico: row.id_historial_medico,
  fecha_creacion: row.fecha_creacion,
});

/**
 * Todas las vacunas de la mascota con su estado calculado sobre **todas** (las vacunas
 * son visibles para el dueño y para cualquier negocio con cita válida).
 */
export const vacunasConEstado = async (id_mascota, conn) => {
  const [rows, dias] = await Promise.all([vacunaRepo.findDeMascota(id_mascota, conn), diasAvisoVacuna()]);
  const estados = calcularEstados(rows, hoyISO(), dias);
  return rows.map((row) => formatVacuna(row, estados.get(row.id_vacuna)));
};

/** Recalcula y guarda el estado de todas las vacunas de la mascota (al escribir). */
const guardarEstados = async (id_mascota, conn) => {
  const [rows, dias] = await Promise.all([vacunaRepo.findDeMascota(id_mascota, conn), diasAvisoVacuna()]);
  const estados = calcularEstados(rows, hoyISO(), dias);
  await vacunaRepo.guardarEstados(
    rows.filter((row) => row.estado !== estados.get(row.id_vacuna)).map((row) => [row.id_vacuna, estados.get(row.id_vacuna)]),
    conn
  );
};

/** fecha_proxima debe ser posterior a fecha_aplicacion. */
const verificarFechas = ({ fecha_aplicacion, fecha_proxima }) => {
  if (fecha_proxima && fecha_aplicacion && fecha_proxima <= fecha_aplicacion) {
    throw invalido({ fecha_proxima: "Debe ser posterior a fecha_aplicacion" });
  }
};

const verificarViva = (mascota) => {
  if (mascota.fallecido) throw ApiError.conflict("La mascota está registrada como fallecida: no se registran vacunas nuevas");
};

export const getVacunasDueno = async (id_usuario, id_mascota) => {
  const { mascota } = await accesoDueno(id_usuario, id_mascota);
  return vacunasConEstado(mascota.id_mascota);
};

export const getVacunasNegocio = async (id_negocio, id_mascota) => {
  const { mascota } = await accesoNegocio(id_negocio, id_mascota);
  return vacunasConEstado(mascota.id_mascota);
};

/** El dueño registra una vacuna externa (queda marcada como del dueño). */
export const crearVacunaDueno = async (id_usuario, id_mascota, data) => {
  verificarFechas(data);
  const id_vacuna = await withTransaction(async (conn) => {
    const { mascota } = await accesoDueno(id_usuario, id_mascota, { conn, forUpdate: true });
    verificarViva(mascota);
    const id = await vacunaRepo.create(
      { ...data, id_mascota, registrada_por: "dueno", id_usuario_registro: id_usuario },
      conn
    );
    await guardarEstados(id_mascota, conn);
    return id;
  });
  return (await vacunasConEstado(id_mascota)).find((v) => v.id_vacuna === id_vacuna);
};

/** Valida los campos que solo registra el negocio (empleado activo y registro propio de la mascota). */
const verificarCamposNegocio = async (id_negocio, id_mascota, data, conn) => {
  const errors = {};
  if (data.id_empleado && !(await historialRepo.empleadoActivoDelNegocio(data.id_empleado, id_negocio, conn))) {
    errors.id_empleado = "No es un empleado activo del negocio";
  }
  if (data.id_historial_medico && !(await vacunaRepo.historialDelNegocio(data.id_historial_medico, id_negocio, id_mascota, conn))) {
    errors.id_historial_medico = "Debe ser un registro de este negocio para esta mascota";
  }
  if (Object.keys(errors).length > 0) throw invalido(errors);
};

/**
 * El negocio registra una vacuna para una mascota con cita válida. `id_empleado` por
 * defecto es el perfil de empleado de quien registra.
 */
export const crearVacunaNegocio = async (negocio, { id_usuario, acceso }, { id_mascota, ...data }) => {
  verificarFechas(data);
  const id_vacuna = await withTransaction(async (conn) => {
    const { mascota } = await accesoNegocio(negocio.id_negocio, id_mascota, { conn, forUpdate: true });
    verificarViva(mascota);
    await verificarCamposNegocio(negocio.id_negocio, id_mascota, data, conn);
    const id_empleado =
      data.id_empleado !== undefined
        ? data.id_empleado
        : (acceso.id_empleado ??
          (await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio, conn))?.id_empleado ??
          null);
    const id = await vacunaRepo.create(
      {
        ...data,
        id_empleado,
        id_mascota,
        id_negocio: negocio.id_negocio,
        registrada_por: "negocio",
        id_usuario_registro: id_usuario,
      },
      conn
    );
    await guardarEstados(id_mascota, conn);
    return id;
  });
  return (await vacunasConEstado(id_mascota)).find((v) => v.id_vacuna === id_vacuna);
};

/**
 * Edita una vacuna. La registrada por el dueño solo la edita el dueño; la de un negocio,
 * solo ese negocio (authorizeDuenoO + resolver de id_vacuna). El dueño no envía los
 * campos del negocio (id_empleado, id_historial_medico).
 */
export const actualizarVacuna = async (id_vacuna, data, acceso) => {
  const esDueno = acceso.relacion === "dueno";
  // Se busca fuera de la transacción: una lectura sin bloqueo dentro fijaría la foto antes de los bloqueos.
  const { id_mascota: idMascota } = await vacunaRepo.findMascotaDeVacuna(id_vacuna);
  const id_mascota = await withTransaction(async (conn) => {
    // Mismo orden que al crear (mascota y luego vacuna): sin deadlocks entre alta y edición.
    await vacunaRepo.lockMascota(idMascota, conn);
    const vacuna = await vacunaRepo.lockVacuna(id_vacuna, conn);
    if (vacuna.registrada_por === "dueno" && !esDueno) {
      throw ApiError.forbidden("Solo el dueño edita las vacunas que registró");
    }
    if (vacuna.registrada_por === "negocio" && esDueno) {
      throw ApiError.forbidden("Solo el negocio que la registró puede editar esta vacuna");
    }
    if (esDueno) {
      const ajenos = CAMPOS_SOLO_NEGOCIO.filter((c) => c in data);
      if (ajenos.length > 0) throw invalido(Object.fromEntries(ajenos.map((c) => [c, "Solo lo registra el negocio"])));
    } else {
      await verificarCamposNegocio(vacuna.id_negocio, vacuna.id_mascota, data, conn);
    }
    const actual = await vacunaRepo.findById(id_vacuna, conn);
    verificarFechas({
      fecha_aplicacion: data.fecha_aplicacion ?? actual.fecha_aplicacion,
      fecha_proxima: data.fecha_proxima !== undefined ? data.fecha_proxima : actual.fecha_proxima,
    });
    await vacunaRepo.update(id_vacuna, data, conn);
    await guardarEstados(vacuna.id_mascota, conn);
    return vacuna.id_mascota;
  });
  return (await vacunasConEstado(id_mascota)).find((v) => v.id_vacuna === id_vacuna);
};
