import * as disponibilidadRepo from "./disponibilidad.repository.js";
import { calcularDisponibilidad, citaCabe, comoHoras, diaSemana } from "./disponibilidad.calculo.js";
import { COLUMNAS_POR_TIPO, excepcionSchema } from "./disponibilidad.schemas.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { pick } from "../../shared/utils/pick.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const hhmm = (hora) => hora.slice(0, 5);

const MENSAJE_CREADA = {
  bloqueo: "Bloqueo registrado",
  vacacion: "Vacaciones registradas",
  evento_especial: "Evento especial registrado",
};

// ---------- Formato ----------

const formatHorario = ({ id_disponibilidad, dia_semana, hora_inicio, hora_fin, id_sucursal }) => ({
  id_disponibilidad,
  dia_semana,
  hora_inicio,
  hora_fin,
  id_sucursal,
});

const formatExcepcion = (row) => ({
  id_disponibilidad: row.id_disponibilidad,
  id_empleado: row.id_empleado,
  tipo: row.tipo,
  fecha_especifica: row.fecha_especifica,
  fecha_fin: row.fecha_fin,
  hora_inicio: row.hora_inicio,
  hora_fin: row.hora_fin,
  id_sucursal: row.id_sucursal,
  motivo: row.motivo,
});

const formatCitaAfectada = (c) => ({
  id_cita: c.id_cita,
  fecha: c.fecha,
  hora_inicio: c.hora_inicio,
  hora_fin: c.hora_fin,
  estado: c.estado,
  sucursal: c.id_sucursal === null ? null : { id_sucursal: c.id_sucursal, nombre: c.sucursal_nombre },
  servicio: { id_servicio: c.id_servicio, nombre: c.servicio_nombre },
  mascota: { id_mascota: c.id_mascota, nombre: c.mascota_nombre },
  cliente: { id_usuario: c.id_usuario, nombre: c.cliente_nombre, apellido: c.cliente_apellido, telefono: c.cliente_telefono },
});

/**
 * "Bloqueo registrado" + ". N citas quedan fuera de la disponibilidad del empleado" si hay
 * afectadas. `fueraDe` cambia el final (el horario de una sede no es la disponibilidad de un empleado).
 */
export const mensajeConAfectadas = (mensaje, citas_afectadas, fueraDe = "de la disponibilidad del empleado") => {
  const n = citas_afectadas.length;
  if (n === 0) return mensaje;
  return `${mensaje}. ${n} ${n === 1 ? "cita queda" : "citas quedan"} fuera ${fueraDe}`;
};

// ---------- Validaciones ----------

/** Empleado bloqueado (FOR UPDATE) y activo; 409 si está inactivo. */
const lockEmpleadoActivo = async (id_empleado, conn) => {
  const empleado = await disponibilidadRepo.lockEmpleado(id_empleado, conn);
  if (!empleado) throw ApiError.notFound("Empleado no encontrado");
  if (!empleado.activo) throw ApiError.conflict("El empleado está inactivo: reactívalo antes de cambiar su disponibilidad");
  return empleado;
};

/** Los ids de sucursal (con su ruta de error) deben ser sucursales activas del negocio. */
const verificarSucursales = async (id_negocio, referencias, conn) => {
  const conId = referencias.filter((r) => r.id_sucursal !== null && r.id_sucursal !== undefined);
  if (conId.length === 0) return;
  const activas = new Set((await disponibilidadRepo.findSucursalesActivas(id_negocio, conn)).map((s) => s.id_sucursal));
  const errors = {};
  for (const { id_sucursal, ruta } of conId) {
    if (!activas.has(id_sucursal)) errors[ruta] = "La sucursal no existe o no está activa en este negocio";
  }
  if (Object.keys(errors).length > 0) throw ApiError.unprocessable("Datos inválidos", errors);
};

/**
 * Los rangos de un mismo día no se cruzan, aunque sean de sucursales distintas
 * (el empleado no puede estar en dos sitios). Pueden tocarse. Errores por índice.
 */
const validarCrucesSemanales = (horarios) => {
  const errors = {};
  const ordenados = horarios
    .map((rango, indice) => ({ ...rango, indice }))
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
  for (let i = 1; i < ordenados.length; i++) {
    const anterior = ordenados[i - 1];
    const actual = ordenados[i];
    if (actual.dia_semana === anterior.dia_semana && actual.hora_inicio < anterior.hora_fin) {
      errors[`horarios.${actual.indice}`] =
        `Se cruza con el rango de ${hhmm(anterior.hora_inicio)} a ${hhmm(anterior.hora_fin)} del ${DIAS[actual.dia_semana]}`;
    }
  }
  if (Object.keys(errors).length > 0) throw ApiError.unprocessable("Hay rangos de horario que se cruzan", errors);
};

/** Los eventos especiales del empleado en la misma fecha no se cruzan entre sí (en ninguna sucursal). */
const verificarEventoSinCruces = async (id_empleado, evento, excluirId, conn) => {
  const otros = await disponibilidadRepo.findExcepciones(
    id_empleado,
    { desde: evento.fecha_especifica, hasta: evento.fecha_especifica, tipo: "evento_especial", excluirId },
    conn
  );
  const inicio = hhmm(evento.hora_inicio);
  const fin = hhmm(evento.hora_fin);
  const cruce = otros.find((o) => inicio < o.hora_fin && o.hora_inicio < fin);
  if (cruce) {
    throw ApiError.unprocessable("Datos inválidos", {
      hora_inicio: `Se cruza con otro evento especial del empleado ese día (${cruce.hora_inicio} a ${cruce.hora_fin})`,
    });
  }
};

// ---------- Citas afectadas ----------

/**
 * Citas futuras pendientes o confirmadas del empleado que no caben en su
 * disponibilidad actual (se llama al final de la transacción que la cambió).
 */
const citasAfectadas = async (empleado, conn) => {
  const citas = await disponibilidadRepo.findCitasFuturasActivas(empleado.id_empleado, conn);
  if (citas.length === 0) return [];
  const [horarioSemanal, excepciones, horariosPorSucursal] = await Promise.all([
    disponibilidadRepo.findHorarioSemanal(empleado.id_empleado, conn),
    disponibilidadRepo.findExcepciones(empleado.id_empleado, { desde: hoyISO() }, conn),
    disponibilidadRepo.findHorariosSucursales(empleado.id_negocio, conn),
  ]);
  return citas
    .filter((cita) => !citaCabe(cita, { horariosPorSucursal, horarioSemanal, excepciones }))
    .map(formatCitaAfectada);
};

/**
 * Citas futuras pendientes o confirmadas de una sucursal que, con el horario actual
 * de la sucursal, ya no caben en la disponibilidad de su empleado (PUT de horarios).
 * Las citas sin empleado se comparan solo con el horario de la sucursal.
 */
export const citasAfectadasDeSucursal = async (id_sucursal, id_negocio, conn) => {
  const citas = await disponibilidadRepo.findCitasFuturasActivasDeSucursal(id_sucursal, conn);
  if (citas.length === 0) return [];
  const ids = [...new Set(citas.map((c) => c.id_empleado).filter((id) => id !== null))];
  const [horariosPorSucursal, semanales, excepciones] = await Promise.all([
    disponibilidadRepo.findHorariosSucursales(id_negocio, conn),
    disponibilidadRepo.findHorarioSemanalDeEmpleados(ids, conn),
    disponibilidadRepo.findExcepcionesDeEmpleados(ids, hoyISO(), "9999-12-31", conn),
  ]);
  return citas
    .filter(
      (cita) =>
        !citaCabe(cita, {
          horariosPorSucursal,
          horarioSemanal: semanales[cita.id_empleado] ?? [],
          excepciones: excepciones[cita.id_empleado] ?? [],
        })
    )
    .map(formatCitaAfectada);
};

/** Todas las citas futuras pendientes o confirmadas del empleado (al desactivarlo ya no tiene disponibilidad). */
export const citasFuturasDeEmpleado = async (id_empleado, conn) =>
  (await disponibilidadRepo.findCitasFuturasActivas(id_empleado, conn)).map(formatCitaAfectada);

// ---------- Lectura ----------

/** Horario semanal y excepciones (por defecto, las que terminan hoy o después). */
export const getDisponibilidad = async (id_empleado, { desde = hoyISO(), hasta, tipo } = {}) => {
  const [horario, excepciones] = await Promise.all([
    disponibilidadRepo.findHorarioSemanal(id_empleado),
    disponibilidadRepo.findExcepciones(id_empleado, { desde, hasta, tipo }),
  ]);
  return {
    horario_semanal: horario.map(formatHorario),
    sigue_horario_sucursal: horario.length === 0,
    excepciones: excepciones.map(formatExcepcion),
  };
};

/**
 * Rangos en que el empleado está disponible ese día en cada sucursal activa del
 * negocio (o solo en `id_sucursal`). Un empleado inactivo no tiene disponibilidad.
 */
export const getDisponibilidadEfectiva = async (id_empleado, { fecha, id_sucursal }) => {
  const empleado = await disponibilidadRepo.findEmpleado(id_empleado);
  let sucursales = await disponibilidadRepo.findSucursalesActivas(empleado.id_negocio);
  if (id_sucursal !== undefined) {
    sucursales = sucursales.filter((s) => s.id_sucursal === id_sucursal);
    if (sucursales.length === 0) {
      throw ApiError.unprocessable("Datos inválidos", { id_sucursal: "La sucursal no existe o no está activa en este negocio" });
    }
  }
  const [horarioSemanal, excepciones, horariosPorSucursal] = await Promise.all([
    disponibilidadRepo.findHorarioSemanal(id_empleado),
    disponibilidadRepo.findExcepciones(id_empleado, { desde: fecha, hasta: fecha }),
    disponibilidadRepo.findHorariosSucursales(empleado.id_negocio),
  ]);

  return {
    fecha,
    dia_semana: diaSemana(fecha),
    sigue_horario_sucursal: horarioSemanal.length === 0,
    sucursales: sucursales.map(({ id_sucursal: id, nombre }) => ({
      id_sucursal: id,
      nombre,
      rangos: empleado.activo
        ? comoHoras(
            calcularDisponibilidad({
              fecha,
              id_sucursal: id,
              horarioSucursal: horariosPorSucursal[id] ?? [],
              horarioSemanal,
              excepciones,
            })
          )
        : [],
    })),
  };
};

// ---------- Escritura ----------

/** Reemplaza el `horario_normal` del empleado. Lista vacía = sigue el horario de la sucursal. */
export const replaceHorarioSemanal = async (id_empleado, horarios) => {
  validarCrucesSemanales(horarios);
  return withTransaction(async (conn) => {
    const empleado = await lockEmpleadoActivo(id_empleado, conn);
    await verificarSucursales(
      empleado.id_negocio,
      horarios.map((h, i) => ({ id_sucursal: h.id_sucursal, ruta: `horarios.${i}.id_sucursal` })),
      conn
    );
    await disponibilidadRepo.replaceHorarioSemanal(id_empleado, horarios, conn);
    const horario = await disponibilidadRepo.findHorarioSemanal(id_empleado, conn);
    return { horario_semanal: horario.map(formatHorario), citas_afectadas: await citasAfectadas(empleado, conn) };
  });
};

/** Valida lo que depende de la base (sucursal del evento y cruces entre eventos) y guarda. */
const validarExcepcion = async (empleado, excepcion, excluirId, conn) => {
  if (excepcion.tipo !== "evento_especial") return;
  await verificarSucursales(empleado.id_negocio, [{ id_sucursal: excepcion.id_sucursal, ruta: "id_sucursal" }], conn);
  await verificarEventoSinCruces(empleado.id_empleado, excepcion, excluirId, conn);
};

export const createExcepcion = async (id_empleado, data) =>
  withTransaction(async (conn) => {
    const empleado = await lockEmpleadoActivo(id_empleado, conn);
    await validarExcepcion(empleado, data, 0, conn);
    const id = await disponibilidadRepo.create(id_empleado, data, conn);
    const citas_afectadas = await citasAfectadas(empleado, conn);
    return {
      disponibilidad: formatExcepcion(await disponibilidadRepo.findById(id, conn)),
      citas_afectadas,
      mensaje: mensajeConAfectadas(MENSAJE_CREADA[data.tipo], citas_afectadas),
    };
  });

/** Registro activo de tipo excepción; el horario semanal se cambia con el PUT (409). */
const findExcepcionActiva = async (id_disponibilidad, conn) => {
  const row = await disponibilidadRepo.findById(id_disponibilidad, conn);
  if (!row?.activo) throw ApiError.notFound("Disponibilidad no encontrada");
  if (row.tipo === "horario_normal") {
    throw ApiError.conflict("El horario semanal se cambia completo con PUT /empleados/:id_empleado/horario-semanal");
  }
  return row;
};

/**
 * Edición parcial: el body se combina con la fila actual y se valida con el
 * esquema de su tipo (un campo que el tipo no tiene da 422).
 */
export const updateExcepcion = async (id_disponibilidad, data) =>
  withTransaction(async (conn) => {
    const actual = await findExcepcionActiva(id_disponibilidad, conn);
    const empleado = await lockEmpleadoActivo(actual.id_empleado, conn);
    const combinado = excepcionSchema(actual.tipo).parse({ ...pick(actual, COLUMNAS_POR_TIPO[actual.tipo]), ...data });
    await validarExcepcion(empleado, combinado, id_disponibilidad, conn);
    await disponibilidadRepo.update(id_disponibilidad, combinado, conn);
    const citas_afectadas = await citasAfectadas(empleado, conn);
    return {
      disponibilidad: formatExcepcion(await disponibilidadRepo.findById(id_disponibilidad, conn)),
      citas_afectadas,
      mensaje: mensajeConAfectadas("Disponibilidad actualizada", citas_afectadas),
    };
  });

/** Borrado lógico. Quitar un evento especial puede dejar citas fuera de la disponibilidad. */
export const deleteExcepcion = async (id_disponibilidad) =>
  withTransaction(async (conn) => {
    const actual = await findExcepcionActiva(id_disponibilidad, conn);
    const empleado = await lockEmpleadoActivo(actual.id_empleado, conn);
    await disponibilidadRepo.softDelete(id_disponibilidad, conn);
    const citas_afectadas = await citasAfectadas(empleado, conn);
    return { citas_afectadas, mensaje: mensajeConAfectadas("Disponibilidad eliminada", citas_afectadas) };
  });
