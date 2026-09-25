import * as horarioRepo from "./horario.repository.js";
import * as sucursalRepo from "../sucursales/sucursal.repository.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const hhmm = (hora) => hora.slice(0, 5);

/**
 * Los rangos de un mismo día no pueden cruzarse. Pueden tocarse (08:00–12:00 y
 * 12:00–14:00). Los errores se reportan por índice del arreglo recibido.
 */
export const validarRangos = (horarios) => {
  const errors = {};
  const ordenados = horarios
    .map((rango, indice) => ({ ...rango, indice }))
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_apertura.localeCompare(b.hora_apertura));

  for (let i = 1; i < ordenados.length; i++) {
    const anterior = ordenados[i - 1];
    const actual = ordenados[i];
    if (actual.dia_semana === anterior.dia_semana && actual.hora_apertura < anterior.hora_cierre) {
      errors[`horarios.${actual.indice}`] =
        `Se cruza con el rango de ${hhmm(anterior.hora_apertura)} a ${hhmm(anterior.hora_cierre)} del ${DIAS[actual.dia_semana]}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw ApiError.unprocessable("Hay rangos de horario que se cruzan", errors);
  }
};

/** Público: horarios de una sucursal activa de un negocio activo. */
export const getHorarios = async (id_sucursal) => {
  if (!(await sucursalRepo.findPublicaById(id_sucursal))) {
    throw ApiError.notFound("Sucursal no encontrada");
  }
  return horarioRepo.findBySucursal(id_sucursal);
};

/** Reemplaza la semana completa en una transacción. authorize ya verificó el permiso. */
export const replaceHorarios = async (id_sucursal, horarios) => {
  validarRangos(horarios);
  return withTransaction(async (conn) => {
    const sucursal = await sucursalRepo.findById(id_sucursal, conn);
    if (!sucursal?.activo) throw ApiError.notFound("Sucursal no encontrada");
    await horarioRepo.replaceBySucursal(id_sucursal, horarios, conn);
    return horarioRepo.findBySucursal(id_sucursal, conn);
  });
};
