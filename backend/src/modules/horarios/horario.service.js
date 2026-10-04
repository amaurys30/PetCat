import * as horarioRepo from "./horario.repository.js";
import * as sucursalRepo from "../sucursales/sucursal.repository.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { citasAfectadasDeSucursal } from "../disponibilidad/disponibilidad.service.js";

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

/**
 * Reemplaza la semana completa en una transacción. authorize ya verificó el permiso.
 * Devuelve los horarios y `citas_afectadas`: citas futuras pendientes o confirmadas de
 * la sucursal que ya no caben (el cambio se guarda igual).
 */
export const replaceHorarios = async (id_sucursal, horarios) => {
  validarRangos(horarios);
  return withTransaction(async (conn) => {
    // Primero el bloqueo de la sede (por clave primaria) y después las lecturas.
    const sucursal = await sucursalRepo.lockById(id_sucursal, conn);
    if (!sucursal?.activo) throw ApiError.notFound("Sucursal no encontrada");
    await horarioRepo.replaceBySucursal(id_sucursal, horarios, conn);
    return {
      horarios: await horarioRepo.findBySucursal(id_sucursal, conn),
      citas_afectadas: await citasAfectadasDeSucursal(id_sucursal, sucursal.id_negocio, conn),
    };
  });
};
