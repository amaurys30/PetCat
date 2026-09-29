import * as citaRepo from "./cita.repository.js";
import * as servicioRepo from "../servicios/servicio.repository.js";
import * as disponibilidadRepo from "../disponibilidad/disponibilidad.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { errorLimiteCitas, getLimiteCitasMes, motivoLimiteCitas } from "../suscripciones/suscripcion.service.js";
import { combinarHorarios, iniciosLibres } from "./citas.calculo.js";
import { aHora, aMinutos, calcularDisponibilidad, citaCabe, diaSemana } from "../disponibilidad/disponibilidad.calculo.js";
import { avisarLimiteAlcanzado, eventoCita, eventoUmbralPlan } from "./cita.avisos.js";
import { conNotificaciones } from "../notificaciones/notificacion.service.js";
import { inicioDeCita } from "../notificaciones/silencio.js";
import { calcularPlazoConfirmacion, configConfirmacion } from "./cita.confirmacion.js";
import { aDatetimeSQL, hoyISO } from "../../shared/utils/fechas.js";
import { toNumber } from "../../shared/utils/format.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { ApiError } from "../../shared/errors/ApiError.js";

// Valores de servicios.dias_disponible (SET, sin tildes) y su nombre para mensajes.
const DIAS_SET = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DIAS_TEXTO = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

const invalido = (campo, mensaje) => ApiError.unprocessable("Datos inválidos", { [campo]: mensaje });

const SIN_HORARIOS = "No hay horarios disponibles para esa fecha";

/** Parámetros de la agenda (configuracion_global), con valores por defecto. */
export const configAgenda = async () => {
  const [intervalo, antelacion, horizonte] = await Promise.all([
    configuracionRepo.getValor("intervalo_agenda_min", 15),
    configuracionRepo.getValor("antelacion_minima_reserva_min", 60),
    configuracionRepo.getValor("horizonte_reserva_dias", 60),
  ]);
  return { intervalo, antelacion, horizonte };
};

const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/** Minuto actual del día (redondeado hacia arriba). */
const minutoActual = () => {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes() + (ahora.getSeconds() > 0 || ahora.getMilliseconds() > 0 ? 1 : 0);
};

/**
 * Validaciones comunes de horarios libres y reservas. `canal` "app" exige servicio
 * visible y negocio activo y aplica la antelación mínima; "panel" admite servicios
 * ocultos del propio negocio y solo exige que el horario sea futuro.
 * Devuelve el servicio, los empleados candidatos, el primer minuto permitido y,
 * si ese día no hay horarios por el servicio, `motivo`.
 */
const prepararDia = async ({ canal, id_negocio, id_servicio, id_sucursal, fecha, id_empleado, excluirIdCita = 0 }) => {
  const config = await configAgenda();
  const servicio = await servicioRepo.findById(id_servicio);
  const visible =
    servicio?.activo &&
    (canal === "panel"
      ? servicio.id_negocio === id_negocio
      : servicio.visible_app && (await citaRepo.negocioActivo(servicio.id_negocio)));
  if (!visible) throw invalido("id_servicio", "El servicio no existe o no está disponible");

  const sucursales = await disponibilidadRepo.findSucursalesActivas(servicio.id_negocio);
  const sucursal = sucursales.find((s) => s.id_sucursal === id_sucursal);
  if (!sucursal) throw invalido("id_sucursal", "La sucursal no existe o no está activa en este negocio");

  const hoy = hoyISO();
  if (fecha < hoy) throw invalido("fecha", "No puede ser una fecha pasada");
  const limite = sumarDias(hoy, config.horizonte);
  if (fecha > limite) throw invalido("fecha", `Solo se puede reservar hasta el ${limite}`);

  if (!servicio.requiere_cita) throw ApiError.conflict("Este servicio no requiere cita: se atiende por orden de llegada");
  let empleados = await citaRepo.findEmpleadosAsignados(id_servicio);
  if (empleados.length === 0) throw ApiError.conflict("El servicio no tiene profesionales asignados: no se puede reservar");
  if (id_empleado !== undefined) {
    empleados = empleados.filter((e) => e.id_empleado === id_empleado);
    if (empleados.length === 0) throw invalido("id_empleado", "Ese empleado no atiende este servicio");
  }

  // Límite de citas del mes del plan: la app no revela el plan del negocio (motivo genérico).
  const limiteCitas = await getLimiteCitasMes(servicio.id_negocio, fecha, { excluirIdCita });
  let motivo = null;
  const dia = diaSemana(fecha);
  if (servicio.dias_disponible && !servicio.dias_disponible.split(",").includes(DIAS_SET[dia])) {
    motivo = `El servicio no se ofrece los ${DIAS_TEXTO[dia]}`;
  } else if (limiteCitas.alcanzado) {
    motivo = canal === "app" ? SIN_HORARIOS : motivoLimiteCitas(limiteCitas, fecha);
  } else if (servicio.max_citas_dia && (await citaRepo.countCupos({ id_servicio, id_sucursal, fecha, excluirIdCita })) >= servicio.max_citas_dia) {
    motivo = "No quedan cupos para este servicio ese día";
  }

  const desde = fecha === hoy ? minutoActual() + (canal === "app" ? config.antelacion : 0) : 0;
  return {
    servicio,
    sucursal,
    empleados,
    desde,
    motivo,
    porLimitePlan: motivo !== null && limiteCitas.alcanzado,
    limiteCitas,
    intervalo: config.intervalo,
  };
};

/**
 * Inicios libres de cada empleado ese día en la sucursal: disponibilidad efectiva
 * (1.4) menos sus citas (con margen), sobre la cuadrícula.
 */
export const evaluarDia = async ({ servicio, id_sucursal, fecha, empleados, desde, intervalo }, conn) => {
  const ids = empleados.map((e) => e.id_empleado);
  const [horariosPorSucursal, ocupados] = await Promise.all([
    disponibilidadRepo.findHorariosSucursales(servicio.id_negocio, conn),
    citaRepo.findOcupadosDeEmpleados(ids, fecha, conn),
  ]);
  return Promise.all(
    empleados.map(async (empleado) => {
      const [horarioSemanal, excepciones] = await Promise.all([
        disponibilidadRepo.findHorarioSemanal(empleado.id_empleado, conn),
        disponibilidadRepo.findExcepciones(empleado.id_empleado, { desde: fecha, hasta: fecha }, conn),
      ]);
      const rangos = calcularDisponibilidad({
        fecha,
        id_sucursal,
        horarioSucursal: horariosPorSucursal[id_sucursal] ?? [],
        horarioSemanal,
        excepciones,
      });
      const inicios = iniciosLibres({
        rangos,
        ocupados: ocupados[empleado.id_empleado] ?? [],
        duracion: servicio.duracion_minutos,
        margen: servicio.margen_minutos,
        intervalo,
        desde,
      });
      return { empleado, inicios };
    })
  );
};

/** Horarios libres de un servicio en una sucursal y una fecha (app o panel). */
export const getHorariosLibres = async (canal, { id_negocio, ...query }) => {
  const dia = await prepararDia({ canal, id_negocio, ...query });
  const horarios = dia.motivo
    ? []
    : combinarHorarios(await evaluarDia({ ...dia, id_sucursal: query.id_sucursal, fecha: query.fecha }), dia.servicio.duracion_minutos);
  return {
    fecha: query.fecha,
    servicio: {
      id_servicio: dia.servicio.id_servicio,
      nombre: dia.servicio.nombre,
      duracion_minutos: dia.servicio.duracion_minutos,
      precio_actual: toNumber(dia.servicio.precio_actual),
    },
    sucursal: dia.sucursal,
    horarios: horarios.map((h) => ({ hora_inicio: aHora(h.inicio), hora_fin: aHora(h.fin), empleados: h.empleados })),
    motivo_sin_horarios: horarios.length > 0 ? null : (dia.motivo ?? SIN_HORARIOS),
  };
};

/** La mascota puede recibir este servicio: activa, del dueño, viva, de una especie y un peso admitidos. */
const verificarMascota = (mascota, id_usuario, servicio) => {
  if (!mascota?.activo || mascota.id_usuario !== id_usuario) {
    throw invalido("id_mascota", "La mascota no existe o no pertenece al cliente");
  }
  if (mascota.fallecido) throw ApiError.conflict("La mascota está registrada como fallecida: no puede recibir citas");

  const especies = servicio.tipo_mascota.split(",");
  if (!especies.includes("todos") && !especies.includes(mascota.especie)) {
    throw invalido("id_mascota", `El servicio no atiende la especie ${mascota.especie}`);
  }
  const peso = toNumber(mascota.peso);
  const min = toNumber(servicio.peso_min_kg);
  const max = toNumber(servicio.peso_max_kg);
  if (peso !== null && ((min !== null && peso < min) || (max !== null && peso > max))) {
    const rango = min !== null && max !== null ? `de ${min} a ${max} kg` : min !== null ? `de ${min} kg o más` : `de hasta ${max} kg`;
    throw invalido("id_mascota", `El servicio es para mascotas ${rango}`);
  }
};

/** Formato de la cita. `conNotasInternas` solo para el panel. */
export const formatCita = (row, { conNotasInternas = false } = {}) => ({
  id_cita: row.id_cita,
  fecha: row.fecha,
  hora_inicio: row.hora_inicio,
  hora_fin: row.hora_fin,
  estado: row.estado,
  origen: row.origen,
  prioridad: row.prioridad,
  precio_estimado: toNumber(row.precio_estimado),
  precio_final: toNumber(row.precio_final),
  notas_cliente: row.notas_cliente,
  ...(conNotasInternas && { notas_internas: row.notas_internas }),
  id_cita_origen: row.id_cita_origen,
  // Hasta cuándo puede confirmarla el negocio antes de que se cancele sola (solo pendientes).
  confirmar_antes_de: row.estado === "pendiente" ? (row.confirmar_antes_de ?? null) : null,
  cancelacion:
    row.estado === "cancelada"
      ? {
          por: row.cancelada_por,
          fecha: row.fecha_cancelacion,
          tardia: Boolean(row.cancelacion_tardia),
          motivo: row.motivo_cancelacion,
        }
      : null,
  negocio: { id_negocio: row.id_negocio, nombre: row.negocio_nombre, logo_url: row.negocio_logo_url },
  // Con teléfono y coordenadas: la app muestra dónde es la cita y ofrece "Cómo llegar".
  sucursal: row.id_sucursal
    ? {
        id_sucursal: row.id_sucursal,
        nombre: row.sucursal_nombre,
        direccion: row.sucursal_direccion,
        telefono: row.sucursal_telefono,
        latitud: toNumber(row.sucursal_latitud),
        longitud: toNumber(row.sucursal_longitud),
      }
    : null,
  servicio: { id_servicio: row.id_servicio, nombre: row.servicio_nombre, duracion_minutos: row.duracion_minutos },
  empleado: row.id_empleado ? { id_empleado: row.id_empleado, nombre: row.empleado_nombre, apellido: row.empleado_apellido } : null,
  mascota: { id_mascota: row.id_mascota, nombre: row.mascota_nombre, especie: row.mascota_especie },
  cliente: { id_usuario: row.id_usuario, nombre: row.cliente_nombre, apellido: row.cliente_apellido, telefono: row.cliente_telefono },
  fecha_creacion: row.fecha_creacion,
});

/**
 * Crea una cita desde la app ("app": pendiente, origen app_movil) o el panel
 * ("panel": confirmada, con recordatorio). En una transacción bloquea, en este orden,
 * las suscripciones del negocio (si su plan limita las citas del mes) y, por clave
 * primaria, el servicio (si tiene max_citas_dia), los empleados candidatos y la
 * mascota, y vuelve a comprobar el límite del plan y el horario. Sin id_empleado
 * asigna al empleado libre con menos citas ese día (a igualdad, el de menor id).
 * Límite de citas del mes alcanzado: 409 neutro en la app, 403 con el motivo en el panel.
 * @param {"app"|"panel"} canal
 * @param {object} datos Body validado (+ id_usuario del cliente)
 * @param {{ id_usuario, id_empleado?, ip? }} actor Quién reserva (para el historial)
 * @param {number} [id_negocio] Negocio del panel
 * @param {object} [reprogramacion] Para reprogramar: `excluirIdCita` (la original no cuenta en los cupos),
 *   `antes(conn)` (bloquea y marca la original; va primero en la transacción), `despues(id, conn)`,
 *   `precio_estimado` y `origen` (los de la original), `motivoCreacion` (historial de la nueva) y
 *   `aviso` ({ fecha_anterior, hora_anterior, motivo } para la notificación de reprogramación).
 * Notifica a la otra parte (2.3) y, si la reserva cruza el 80 % del límite del mes, al negocio.
 */
export const crearCita = async (canal, datos, actor, id_negocio, reprogramacion) => {
  try {
    return await reservar(canal, datos, actor, id_negocio, reprogramacion);
  } catch (err) {
    // Reserva rechazada por el límite del plan: se avisa al negocio (una vez al día) y se responde el error.
    if (err.limitePlan) await avisarLimiteAlcanzado(err.limitePlan, actor);
    throw err;
  }
};

/**
 * Evento de la cita recién creada: reprogramada (a la otra parte), nueva desde la app (al
 * negocio) o agendada desde el panel (al dueño). Con la confirmación automática, el negocio
 * recibe el texto de cita confirmada y el dueño no recibe cita_confirmada (la respuesta ya lo dice).
 */
const eventoCreacion = (id_cita, canal, actor, reprogramacion, autoConfirmada, conn) => {
  const extra = { confirmada: autoConfirmada };
  if (reprogramacion) {
    return eventoCita("cita_reprogramada", id_cita, {
      para: canal === "app" ? "negocio" : "dueno",
      actor,
      extra: { ...reprogramacion.aviso, ...extra },
    }, conn);
  }
  return canal === "app"
    ? eventoCita("cita_nueva", id_cita, { para: "negocio", actor, extra }, conn)
    : eventoCita("cita_agendada", id_cita, { para: "dueno", actor }, conn);
};

const reservar = async (canal, datos, actor, id_negocio, reprogramacion) => {
  const dia = await prepararDia({ canal, id_negocio, ...datos, excluirIdCita: reprogramacion?.excluirIdCita });
  const inicio = aMinutos(datos.hora_inicio);
  if (inicio % dia.intervalo !== 0) {
    throw invalido("hora_inicio", `Debe estar en la cuadrícula de ${dia.intervalo} minutos (p. ej. :00, :15, :30, :45)`);
  }
  const { servicio } = dia;
  if (dia.porLimitePlan) throw errorLimiteCitas(canal, dia.limiteCitas, datos.fecha, servicio.id_negocio);
  if (dia.motivo) throw ApiError.conflict(dia.motivo);
  const hora_fin = `${aHora(inicio + servicio.duracion_minutos)}:00`;
  // Confirmación automática del negocio (2.5): la cita de la app nace confirmada. Si no, queda
  // pendiente con un plazo para confirmar, calculado con la configuración de ahora.
  const autoConfirmada = canal === "app" && (await citaRepo.confirmaAutomaticamente(dia.servicio.id_negocio));
  const confirmacion = canal === "app" && !autoConfirmada ? await configConfirmacion() : null;

  // Con plan ilimitado no se bloquea ni se cuenta: las reservas del negocio no se esperan entre sí.
  const conLimiteCitas = dia.limiteCitas.usadas !== null;

  const id_cita = await conNotificaciones(async (conn, notificar) => {
    // Primero todos los bloqueos y después las lecturas: en REPEATABLE READ la primera
    // lectura sin bloqueo fija la foto de la transacción, y debe ser posterior a la
    // espera para ver las citas que otras reservas confirmaron mientras tanto.
    // Orden: cita original (al reprogramar), suscripciones (si el plan limita las
    // citas del mes), servicio, empleados, mascota.
    if (reprogramacion) await reprogramacion.antes(conn);
    const suscripciones = conLimiteCitas ? await suscripcionRepo.lockByNegocio(servicio.id_negocio, conn) : null;
    if (servicio.max_citas_dia) await citaRepo.lockServicio(servicio.id_servicio, conn);
    // Un empleado desactivado mientras tanto ya no cuenta (la desactivación bloquea la misma fila).
    const activos = await citaRepo.lockEmpleados(
      dia.empleados.map((e) => e.id_empleado),
      conn
    );
    const empleados = dia.empleados.filter((e) => activos.includes(e.id_empleado));
    const mascota = await citaRepo.lockMascota(datos.id_mascota, conn);

    let limite = null;
    if (conLimiteCitas) {
      // La original de una reprogramación ya está marcada como reprogramada: no cuenta.
      limite = await getLimiteCitasMes(servicio.id_negocio, datos.fecha, { conn, suscripciones });
      if (limite.alcanzado) throw errorLimiteCitas(canal, limite, datos.fecha, servicio.id_negocio);
    }
    if (servicio.max_citas_dia && (await citaRepo.countCupos(datos, conn)) >= servicio.max_citas_dia) {
      throw ApiError.conflict("No quedan cupos para este servicio ese día");
    }
    verificarMascota(mascota, datos.id_usuario, servicio);

    const libres = (await evaluarDia({ ...dia, empleados, id_sucursal: datos.id_sucursal, fecha: datos.fecha }, conn))
      .filter(({ inicios }) => inicios.includes(inicio))
      .map(({ empleado }) => empleado.id_empleado);
    if (libres.length === 0) throw ApiError.conflict("El horario ya no está disponible: elige otro");

    if (await citaRepo.mascotaTieneCruce({ ...datos, hora_fin }, conn)) {
      throw ApiError.conflict("La mascota ya tiene otra cita a esa hora");
    }

    const carga = await citaRepo.countCitasDelDia(libres, datos.fecha, conn);
    const [id_empleado] = [...libres].sort((a, b) => (carga[a] ?? 0) - (carga[b] ?? 0) || a - b);
    const estado = canal === "app" && !autoConfirmada ? "pendiente" : "confirmada";
    const confirmar_antes_de =
      estado === "pendiente"
        ? aDatetimeSQL(calcularPlazoConfirmacion({ creacion: new Date(), inicio: inicioDeCita(datos.fecha, datos.hora_inicio), ...confirmacion }))
        : undefined;

    const id = await citaRepo.create(
      {
        id_negocio: servicio.id_negocio,
        id_sucursal: datos.id_sucursal,
        id_usuario: datos.id_usuario,
        id_mascota: datos.id_mascota,
        id_servicio: servicio.id_servicio,
        id_empleado,
        fecha: datos.fecha,
        hora_inicio: datos.hora_inicio,
        hora_fin,
        estado,
        precio_estimado: reprogramacion?.precio_estimado ?? servicio.precio_actual,
        notas_cliente: datos.notas_cliente,
        notas_internas: datos.notas_internas,
        prioridad: datos.prioridad,
        origen: reprogramacion?.origen ?? (canal === "app" ? "app_movil" : datos.origen),
        id_cita_origen: reprogramacion?.id_cita_origen,
        confirmar_antes_de,
      },
      conn
    );
    const motivo = autoConfirmada
      ? `${reprogramacion?.motivoCreacion ?? "Cita creada"}. Confirmada automáticamente por el negocio`
      : reprogramacion?.motivoCreacion;
    await citaRepo.insertHistorialCreacion({ id_cita: id, actor, estado, motivo }, conn);
    if (estado === "confirmada") await citaRepo.programarRecordatorios(id, conn);
    if (reprogramacion) await reprogramacion.despues(id, conn);

    // Avisos al final de la transacción: se envían solo si la reserva se confirma.
    const umbral = limite && (await eventoUmbralPlan({ id_negocio: servicio.id_negocio, fecha: datos.fecha, limite, actor }, conn));
    await notificar([await eventoCreacion(id, canal, actor, reprogramacion, autoConfirmada, conn), ...(umbral ? [umbral] : [])]);
    return id;
  });

  return formatCita(await citaRepo.findDetalle(id_cita), { conNotasInternas: canal === "panel" });
};

export const crearCitaApp = (datos, usuario) =>
  crearCita("app", { ...datos, id_usuario: usuario.id_usuario }, { id_usuario: usuario.id_usuario, ip: usuario.ip });

/** Desde el panel: el cliente debe existir y estar activo. */
export const crearCitaPanel = async (id_negocio, datos, actor) => {
  if (!(await citaRepo.usuarioActivo(datos.id_usuario))) throw invalido("id_usuario", "El cliente no existe");
  return crearCita("panel", datos, actor, id_negocio);
};

// ---------- Consultas ----------

/** La cita puede quedar fuera de la disponibilidad del empleado: futura, pendiente o confirmada y con empleado. */
const aplicaDisponibilidad = (row, hoy, ahora) =>
  (row.estado === "pendiente" || row.estado === "confirmada") &&
  row.id_empleado !== null &&
  (row.fecha > hoy || (row.fecha === hoy && row.hora_inicio >= ahora));

const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Marca `fuera_de_disponibilidad` en citas del panel: las que aplican y no caben en
 * la disponibilidad de su empleado (1.4). Carga los datos de todos los empleados en lote.
 */
const conDisponibilidad = async (rows, id_negocio, desde, hasta) => {
  if (rows.length === 0) return [];
  const hoy = hoyISO();
  const ahora = horaActual();
  const aplican = rows.filter((row) => aplicaDisponibilidad(row, hoy, ahora));
  const ids = [...new Set(aplican.map((row) => row.id_empleado))];
  const [horariosPorSucursal, semanales, excepciones] = await Promise.all([
    ids.length ? disponibilidadRepo.findHorariosSucursales(id_negocio) : {},
    disponibilidadRepo.findHorarioSemanalDeEmpleados(ids),
    disponibilidadRepo.findExcepcionesDeEmpleados(ids, desde, hasta),
  ]);
  const fuera = new Set(
    aplican
      .filter(
        (row) =>
          !citaCabe(row, {
            horariosPorSucursal,
            horarioSemanal: semanales[row.id_empleado] ?? [],
            excepciones: excepciones[row.id_empleado] ?? [],
          })
      )
      .map((row) => row.id_cita)
  );
  return rows.map((row) => ({ ...formatCita(row, { conNotasInternas: true }), fuera_de_disponibilidad: fuera.has(row.id_cita) }));
};

/** Citas del dueño (app), paginadas y sin notas internas. */
export const getMisCitas = async (id_usuario, { page, limit, alcance, estado, id_mascota }) => {
  const { rows, total } = await citaRepo.findPageDeUsuario(id_usuario, {
    alcance,
    estados: estado,
    id_mascota,
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: rows.map((row) => formatCita(row)), meta: buildMeta(total, page, limit) };
};

/** Los filtros de la agenda deben ser del negocio (422 si no), aunque estén inactivos. */
const verificarFiltros = async (id_negocio, filtros) => {
  const errors = {};
  for (const [campo, tabla] of [
    ["id_sucursal", "sucursales"],
    ["id_empleado", "empleados"],
    ["id_servicio", "servicios"],
  ]) {
    if (filtros[campo] !== undefined && !(await citaRepo.perteneceAlNegocio(tabla, filtros[campo], id_negocio))) {
      errors[campo] = "No pertenece a este negocio";
    }
  }
  if (Object.keys(errors).length > 0) throw ApiError.unprocessable("Datos inválidos", errors);
};

/**
 * Agenda del negocio (sin paginar: el rango es de máximo 31 días). `solo_mias`
 * limita a las citas del perfil de empleado de quien consulta en este negocio
 * (también el propietario registrado como empleado); sin perfil, 422.
 */
export const getAgenda = async (negocio, id_usuario, { solo_mias, fuera_de_disponibilidad, estado, ...filtros }) => {
  if (solo_mias) {
    const empleado = await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio);
    if (!empleado?.activo) {
      throw invalido("solo_mias", "No tienes un perfil de empleado activo en este negocio");
    }
    if (filtros.id_empleado !== undefined && filtros.id_empleado !== empleado.id_empleado) {
      throw invalido("id_empleado", "No se combina con solo_mias");
    }
    filtros.id_empleado = empleado.id_empleado;
  }
  await verificarFiltros(negocio.id_negocio, filtros);

  const rows = await citaRepo.findAgenda({ id_negocio: negocio.id_negocio, estados: estado, ...filtros });
  let citas = await conDisponibilidad(rows, negocio.id_negocio, filtros.desde, filtros.hasta);
  if (fuera_de_disponibilidad !== undefined) citas = citas.filter((c) => c.fuera_de_disponibilidad === fuera_de_disponibilidad);
  return { rows: citas, meta: { total: citas.length, desde: filtros.desde, hasta: filtros.hasta } };
};

/**
 * Detalle de una cita. Con acceso del panel (authorizeDuenoO): completa, con notas
 * internas, fuera_de_disponibilidad y el cumplimiento del cliente en ese negocio
 * (cliente.historial_cumplimiento). Para el dueño: sin notas internas.
 */
export const getCita = async (id_cita, acceso) => {
  const row = await citaRepo.findDetalle(id_cita);
  if (acceso.relacion === "dueno") return formatCita(row);
  const [[cita], historial_cumplimiento] = await Promise.all([
    conDisponibilidad([row], row.id_negocio, row.fecha, row.fecha),
    citaRepo.resumenCumplimiento(row.id_usuario, row.id_negocio),
  ]);
  return { ...cita, cliente: { ...cita.cliente, historial_cumplimiento } };
};

/** Citas en el formato del panel (con notas internas y fuera_de_disponibilidad), de un mismo negocio. */
export const formatCitasPanel = (rows, id_negocio) => {
  const fechas = rows.map((r) => r.fecha).sort();
  return conDisponibilidad(rows, id_negocio, fechas[0], fechas.at(-1));
};
