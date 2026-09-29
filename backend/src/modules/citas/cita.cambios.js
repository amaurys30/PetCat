import * as citaRepo from "./cita.repository.js";
import * as servicioRepo from "../servicios/servicio.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { configAgenda, crearCita, evaluarDia, getCita } from "./cita.service.js";
import { aMinutos } from "../disponibilidad/disponibilidad.calculo.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { eventoCita } from "./cita.avisos.js";
import { conNotificaciones } from "../notificaciones/notificacion.service.js";
import { programarInvitacion } from "../resenas/resena.plazo.js";
import { aDatetimeSQL, hoyISO } from "../../shared/utils/fechas.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Cambios sobre citas existentes: estados, cancelación, reprogramación, edición
 * del panel e historial. Todo cambio bloquea primero la cita por clave primaria
 * (FOR UPDATE) y registra el cambio en historial_citas.
 */

// Máquina de estados del panel (cancelar y reprogramar tienen sus propios endpoints).
// completada, cancelada y reprogramada son finales; no_asistio se corrige a en_curso el mismo día.
export const TRANSICIONES = {
  pendiente: ["confirmada"],
  confirmada: ["en_curso", "no_asistio"],
  en_curso: ["completada"],
  no_asistio: ["en_curso"],
};

const ACTIVAS = ["pendiente", "confirmada"];

/** Inicio de la cita como fecha local (Bogotá). */
const inicioDe = (cita) => new Date(`${cita.fecha}T${cita.hora_inicio.length === 5 ? `${cita.hora_inicio}:00` : cita.hora_inicio}`);

/** Horas de anticipación del dueño (configuracion_global). */
const horasAntelacionApp = () => configuracionRepo.getValor("antelacion_cancelacion_app_h", 2);

const faltaMenosDe = (cita, horas) => inicioDe(cita).getTime() - Date.now() < horas * 3600 * 1000;

const invalido = (campo, mensaje) => ApiError.unprocessable("Datos inválidos", { [campo]: mensaje });

// ---------- Estados (panel) ----------

/**
 * Cambia el estado según TRANSICIONES. en_curso solo desde la fecha de la cita
 * (desde no_asistio, solo el mismo día); no_asistio solo desde la hora de inicio.
 * Al completar se guarda precio_final (por defecto el estimado) y fecha_completada, suma
 * total_citas y se programa la invitación a reseñar (2.6).
 */
export const cambiarEstado = async (id_cita, { estado, motivo, precio_final }, actor, acceso) => {
  await conNotificaciones(async (conn, notificar) => {
    const cita = await citaRepo.lockCita(id_cita, conn);
    const permitidas = TRANSICIONES[cita.estado] ?? [];
    if (!permitidas.includes(estado)) {
      throw ApiError.conflict(
        permitidas.length
          ? `No se puede pasar de ${cita.estado} a ${estado}: desde ${cita.estado} solo a ${permitidas.join(", ")}`
          : `La cita está ${cita.estado}: es un estado final`
      );
    }
    const hoy = hoyISO();
    if (estado === "en_curso") {
      if (cita.estado === "no_asistio" && cita.fecha !== hoy) {
        throw ApiError.conflict("Una inasistencia solo se corrige a en curso el mismo día de la cita");
      }
      if (cita.fecha > hoy) throw ApiError.conflict("La cita todavía no es hoy: no puede estar en curso");
    }
    if (estado === "no_asistio" && Date.now() < inicioDe(cita).getTime()) {
      throw ApiError.conflict("La inasistencia se marca desde la hora de inicio de la cita");
    }
    if (precio_final !== undefined && estado !== "completada") {
      throw invalido("precio_final", "Solo se envía al completar la cita");
    }

    const cambios = { estado };
    const ahora = new Date();
    if (estado === "completada") {
      cambios.precio_final = precio_final ?? cita.precio_estimado;
      cambios.fecha_completada = aDatetimeSQL(ahora);
    }
    await citaRepo.update(id_cita, cambios, conn);
    await citaRepo.insertHistorial({ id_cita, actor, campo: "estado", anterior: cita.estado, nuevo: estado, motivo }, conn);
    if (estado === "completada") {
      await citaRepo.insertHistorial(
        { id_cita, actor, campo: "precio_final", anterior: cita.precio_final, nuevo: cambios.precio_final },
        conn
      );
      await citaRepo.incrementTotalCitas(cita.id_negocio, conn);
      await programarInvitacion(cita, ahora, conn);
    }
    if (estado === "confirmada") {
      await notificar([await eventoCita("cita_confirmada", id_cita, { para: "dueno", actor }, conn)]);
    }
  });
  return getCita(id_cita, acceso);
};

// ---------- Cancelar (dueño o negocio) ----------

/**
 * Solo citas pendientes o confirmadas. El dueño cancela siempre que la cita no
 * haya empezado; a menos de antelacion_cancelacion_app_h horas queda como
 * cancelación tardía. El negocio exige motivo y nunca es tardía. Los
 * recordatorios pendientes se cancelan.
 */
export const cancelarCita = async (id_cita, { motivo }, actor, acceso) => {
  const esDueno = acceso.relacion === "dueno";
  const horas = await horasAntelacionApp();
  await conNotificaciones(async (conn, notificar) => {
    const cita = await citaRepo.lockCita(id_cita, conn);
    if (!ACTIVAS.includes(cita.estado)) {
      throw ApiError.conflict(`Solo se cancelan citas pendientes o confirmadas (esta está ${cita.estado})`);
    }
    let tardia = false;
    if (esDueno) {
      if (Date.now() >= inicioDe(cita).getTime()) throw ApiError.conflict("La cita ya empezó: no se puede cancelar");
      tardia = faltaMenosDe(cita, horas);
    } else if (!motivo) {
      throw invalido("motivo", "Obligatorio al cancelar desde el negocio");
    }

    await citaRepo.update(
      id_cita,
      { estado: "cancelada", motivo_cancelacion: motivo ?? null, cancelada_por: esDueno ? "dueno" : "negocio", cancelacion_tardia: tardia },
      conn,
      { conFechaCancelacion: true }
    );
    await citaRepo.insertHistorial(
      { id_cita, actor, campo: "estado", anterior: cita.estado, nuevo: "cancelada", motivo: tardia ? `Cancelación tardía${motivo ? `: ${motivo}` : ""}` : motivo },
      conn
    );
    await citaRepo.cancelarRecordatoriosPendientes(id_cita, conn);
    // A la otra parte: si cancela el dueño, al personal del negocio; si cancela el negocio, al dueño.
    await notificar([
      await eventoCita("cita_cancelada", id_cita, {
        para: esDueno ? "negocio" : "dueno",
        actor,
        extra: { motivo: motivo ?? null, tardia },
      }, conn),
    ]);
  });
  return getCita(id_cita, acceso);
};

// ---------- Reprogramar (dueño o negocio) ----------

const verificarReprogramable = (cita, esDueno, horas) => {
  if (!ACTIVAS.includes(cita.estado)) {
    throw ApiError.conflict(`Solo se reprograman citas pendientes o confirmadas (esta está ${cita.estado})`);
  }
  if (esDueno && faltaMenosDe(cita, horas)) {
    throw ApiError.conflict(`Solo puedes reprogramar hasta ${horas} horas antes de la cita: comunícate con el negocio`);
  }
};

/**
 * Crea una cita nueva (id_cita_origen) con el mismo cálculo y los mismos bloqueos
 * de la reserva, y marca la original como reprogramada, en una sola transacción:
 * si el horario nuevo no está libre, la original no cambia. El dueño lo hace con
 * las reglas de la app y al menos antelacion_cancelacion_app_h horas antes (la nueva
 * queda pendiente); el negocio, con las del panel (queda confirmada). Conserva el
 * precio estimado, el origen, las notas y la prioridad de la original.
 */
export const reprogramarCita = async (id_cita, { fecha, hora_inicio, id_empleado, id_sucursal, motivo }, actor, acceso) => {
  const esDueno = acceso.relacion === "dueno";
  const horas = await horasAntelacionApp();
  const original = await citaRepo.findCita(id_cita);
  verificarReprogramable(original, esDueno, horas);

  let estadoAnterior;
  const datos = {
    id_servicio: original.id_servicio,
    id_sucursal: id_sucursal ?? original.id_sucursal,
    fecha,
    hora_inicio,
    id_empleado,
    id_mascota: original.id_mascota,
    id_usuario: original.id_usuario,
    notas_cliente: original.notas_cliente ?? undefined,
    notas_internas: original.notas_internas ?? undefined,
    prioridad: original.prioridad,
  };

  return crearCita(esDueno ? "app" : "panel", datos, actor, original.id_negocio, {
    excluirIdCita: id_cita,
    id_cita_origen: id_cita,
    precio_estimado: original.precio_estimado,
    origen: original.origen,
    motivoCreacion: `Reprogramación de la cita #${id_cita}`,
    aviso: { fecha_anterior: original.fecha, hora_anterior: original.hora_inicio, motivo: motivo ?? null },
    antes: async (conn) => {
      const cita = await citaRepo.lockCita(id_cita, conn);
      verificarReprogramable(cita, esDueno, horas);
      estadoAnterior = cita.estado;
      await citaRepo.update(id_cita, { estado: "reprogramada" }, conn);
      await citaRepo.cancelarRecordatoriosPendientes(id_cita, conn);
    },
    despues: (idNueva, conn) =>
      citaRepo.insertHistorial(
        {
          id_cita,
          actor,
          campo: "estado",
          anterior: estadoAnterior,
          nuevo: "reprogramada",
          motivo: `Reprogramada a la cita #${idNueva}${motivo ? `: ${motivo}` : ""}`,
        },
        conn
      ),
  });
};

// ---------- Editar (panel) ----------

/**
 * notas_internas, prioridad, precio_final (solo en curso o completada) e id_empleado
 * (solo pendiente o confirmada): el nuevo empleado debe atender el servicio y estar
 * libre a esa hora, con el mismo cálculo de la reserva. Cada campo que cambia queda
 * en el historial.
 */
export const actualizarCita = async (id_cita, data, actor, acceso) => {
  await withTransaction(async (conn) => {
    const cita = await citaRepo.lockCita(id_cita, conn);
    const cambiaEmpleado = data.id_empleado !== undefined && data.id_empleado !== cita.id_empleado;

    if (data.precio_final !== undefined && !["en_curso", "completada"].includes(cita.estado)) {
      throw ApiError.conflict("El precio final solo se registra en citas en curso o completadas");
    }
    if (cambiaEmpleado) {
      if (!ACTIVAS.includes(cita.estado)) throw ApiError.conflict("Solo se reasignan citas pendientes o confirmadas");
      // Bloqueo antes de leer (ver crearCita).
      await citaRepo.lockEmpleados([data.id_empleado], conn);
      const asignados = await citaRepo.findEmpleadosAsignados(cita.id_servicio, conn);
      const empleado = asignados.find((e) => e.id_empleado === data.id_empleado);
      if (!empleado) throw invalido("id_empleado", "Ese empleado no atiende este servicio o no está activo");
      const servicio = await servicioRepo.findById(cita.id_servicio, { conn });
      const { intervalo } = await configAgenda();
      const [{ inicios }] = await evaluarDia(
        { servicio, id_sucursal: cita.id_sucursal, fecha: cita.fecha, empleados: [empleado], desde: 0, intervalo },
        conn
      );
      if (!inicios.includes(aMinutos(cita.hora_inicio))) {
        throw ApiError.conflict("El empleado no está disponible a esa hora (horario, bloqueos u otra cita)");
      }
    }

    // precio_final llega de MySQL como texto ("50000.00"): se compara como número.
    const igual = (campo, a, b) =>
      campo === "precio_final" && a !== null && b !== null ? Number(a) === Number(b) : String(a ?? "") === String(b ?? "");
    const campos = ["notas_internas", "prioridad", "precio_final", "id_empleado"].filter(
      (c) => data[c] !== undefined && !igual(c, data[c], cita[c])
    );
    const cambios = Object.fromEntries(campos.map((c) => [c, data[c]]));
    await citaRepo.update(id_cita, cambios, conn);
    for (const campo of campos) {
      await citaRepo.insertHistorial({ id_cita, actor, campo, anterior: cita[campo], nuevo: data[campo] }, conn);
    }
  });
  return getCita(id_cita, acceso);
};

// ---------- Historial ----------

// Cambios que ve el dueño: los que afectan su cita, no los internos del negocio.
const CAMPOS_DUENO = ["estado", "id_empleado"];
const NOMBRE_CAMPO = { id_empleado: "empleado" };

/**
 * Historial de la cita. El panel ve todo, con quién hizo cada cambio. El dueño ve
 * solo estado y empleado, con el motivo, y quién lo hizo como "dueno" o "negocio".
 */
export const getHistorial = async (id_cita, acceso) => {
  const [filas, cita] = await Promise.all([citaRepo.findHistorial(id_cita), citaRepo.findCita(id_cita)]);
  const esDueno = acceso.relacion === "dueno";
  const visibles = esDueno ? filas.filter((f) => CAMPOS_DUENO.includes(f.campo_modificado)) : filas;

  const idsEmpleado = visibles
    .filter((f) => f.campo_modificado === "id_empleado")
    .flatMap((f) => [f.valor_anterior, f.valor_nuevo])
    .filter(Boolean)
    .map(Number);
  const nombres = await citaRepo.findNombresEmpleados([...new Set(idsEmpleado)]);
  const valor = (campo, v) => (campo === "id_empleado" && v ? (nombres[v] ?? null) : v);

  return visibles.map((f) => ({
    fecha_cambio: f.fecha_cambio,
    campo: NOMBRE_CAMPO[f.campo_modificado] ?? f.campo_modificado,
    valor_anterior: valor(f.campo_modificado, f.valor_anterior),
    valor_nuevo: valor(f.campo_modificado, f.valor_nuevo),
    motivo: f.motivo,
    // Sin usuario ni empleado: la cancelación automática del job de confirmaciones.
    realizado_por: f.id_usuario === cita.id_usuario ? "dueno" : f.id_usuario || f.id_empleado ? "negocio" : "sistema",
    ...(!esDueno && {
      usuario: f.id_usuario ? { id_usuario: f.id_usuario, nombre: f.usuario_nombre, apellido: f.usuario_apellido } : null,
      empleado: f.id_empleado ? { id_empleado: f.id_empleado, nombre: f.empleado_nombre, apellido: f.empleado_apellido } : null,
    }),
  }));
};
