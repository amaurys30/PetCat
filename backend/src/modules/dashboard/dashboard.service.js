import * as dashboardRepo from "./dashboard.repository.js";
import * as citaRepo from "../citas/cita.repository.js";
import * as suscripcionRepo from "../suscripciones/suscripcion.repository.js";
import { getPlanEfectivo, puedeProbar } from "../suscripciones/suscripcion.service.js";
import { ESTADOS_CITA } from "../citas/cita.schemas.js";
import { diasEntre, hoyISO } from "../../shared/utils/fechas.js";
import { toNumber } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Dashboard del negocio (2.7). Lo básico es para todos los planes; las secciones de
 * `avanzadas` exigen `estadisticas_avanzadas` en el plan efectivo (la prueba Pro cuenta).
 * En los demás llegan como `{ bloqueado: true, plan_requerido }`, sin datos y sin ejecutar
 * sus consultas.
 */

export const RANGO_BASICO_DIAS = 92;
export const RANGO_AVANZADO_DIAS = 366;
const AGRUPAR_POR_DIA_HASTA = 31;
/** Vacunas vencidas en los últimos 30 días: una ventana móvil, no se reinicia el día 1 de cada mes. */
export const VACUNAS_VENCIDAS_DIAS = 30;

const NOTA_INGRESOS =
  "Suma del precio final que el negocio registró al completar cada cita. No son pagos verificados: los pagos en línea llegan en la Fase 3.";

const redondear = (n, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;
const porcentaje = (parte, total) => (total > 0 ? redondear((parte / total) * 100, 1) : null);

/** Suma los días a "YYYY-MM-DD". */
const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return hoyISO(d);
};

const formatPlanRequerido = (plan) =>
  plan ? { id_plan: plan.id_plan, nombre: plan.nombre, precio_mensual: toNumber(plan.precio_mensual) } : null;

// ---------- Resumen por estado ----------

/** Filas de findResumenPorEstado -> totales por estado, ingresos y cancelaciones. */
const resumir = (rows) => {
  const por_estado = Object.fromEntries(ESTADOS_CITA.map((e) => [e, 0]));
  const cancelaciones = { total: 0, por_dueno: 0, por_negocio: 0, por_sistema: 0, tardias: 0 };
  let ingresos = 0;
  for (const row of rows) {
    por_estado[row.estado] = Number(row.total);
    ingresos += Number(row.ingresos);
    if (row.estado === "cancelada") {
      cancelaciones.total = Number(row.total);
      cancelaciones.por_dueno = Number(row.por_dueno);
      cancelaciones.por_negocio = Number(row.por_negocio);
      cancelaciones.por_sistema = Number(row.por_sistema);
      cancelaciones.tardias = Number(row.tardias);
    }
  }
  // Una reprogramación deja la original `reprogramada` y crea otra: no se cuenta dos veces.
  const total = Object.entries(por_estado)
    .filter(([estado]) => estado !== "reprogramada")
    .reduce((suma, [, n]) => suma + n, 0);
  const completadas = por_estado.completada;
  const inasistencias = por_estado.no_asistio;
  return {
    por_estado,
    total,
    completadas,
    ingresos: redondear(ingresos),
    inasistencias,
    tasa_inasistencia: porcentaje(inasistencias, completadas + inasistencias),
    cancelaciones,
  };
};

const formatIngresos = ({ ingresos, completadas }) => ({
  total: ingresos,
  citas_completadas: completadas,
  ticket_promedio: completadas > 0 ? redondear(ingresos / completadas) : null,
  moneda: "COP",
  origen: "citas_completadas",
  verificado: false,
  nota: NOTA_INGRESOS,
});

/** Citas canceladas por el sistema y, si la confirmación automática está apagada, la sugerencia de activarla. */
export const citasPerdidas = (porSistema, confirmacionAutomatica) => ({
  total: porSistema,
  sugerencia:
    porSistema > 0 && !confirmacionAutomatica
      ? {
          codigo: "activar_confirmacion_automatica",
          mensaje: `${porSistema} ${porSistema === 1 ? "cita se canceló porque nadie la confirmó" : "citas se cancelaron porque nadie las confirmó"} a tiempo. Con la confirmación automática, las reservas de la app quedan confirmadas al instante.`,
        }
      : null,
});

// ---------- Avanzadas ----------

/** Serie continua (con ceros) desde `desde` hasta `hasta`, por día, semana (lunes) o mes. */
const serie = (rows, { desde, hasta }, agrupacion) => {
  const porInicio = new Map(rows.map((r) => [r.inicio, r]));
  const puntos = [];
  let inicio =
    agrupacion === "dia"
      ? desde
      : agrupacion === "semana"
        ? sumarDias(desde, -((new Date(`${desde}T12:00:00`).getDay() + 6) % 7))
        : `${desde.slice(0, 7)}-01`;
  while (inicio <= hasta) {
    const row = porInicio.get(inicio);
    puntos.push({
      inicio,
      citas: Number(row?.citas ?? 0),
      completadas: Number(row?.completadas ?? 0),
      ingresos: redondear(Number(row?.ingresos ?? 0)),
    });
    if (agrupacion === "dia") inicio = sumarDias(inicio, 1);
    else if (agrupacion === "semana") inicio = sumarDias(inicio, 7);
    else {
      const [a, m] = inicio.split("-").map(Number);
      inicio = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  return puntos;
};

const agrupacionDe = (dias) => (dias <= AGRUPAR_POR_DIA_HASTA ? "dia" : dias <= RANGO_BASICO_DIAS ? "semana" : "mes");

const variacion = (actual, anterior) => (anterior === null || anterior === 0 || actual === null ? null : redondear(((actual - anterior) / anterior) * 100, 1));

const metricasComparables = (resumen, clientes_nuevos) => ({
  citas: resumen.total,
  completadas: resumen.completadas,
  ingresos: resumen.ingresos,
  clientes_nuevos,
  tasa_inasistencia: resumen.tasa_inasistencia,
});

const filaDesempeno = (row) => ({
  citas: Number(row.citas),
  completadas: Number(row.completadas),
  ingresos: redondear(Number(row.ingresos)),
  inasistencias: Number(row.inasistencias),
});

/** Secciones avanzadas (solo con estadisticas_avanzadas). */
const calcularAvanzadas = async (filtro, periodo, actual) => {
  const agrupacion = agrupacionDe(periodo.dias);
  const anterior = { desde: sumarDias(periodo.desde, -periodo.dias), hasta: sumarDias(periodo.desde, -1) };
  const filtroAnterior = { ...filtro, ...anterior };

  const [tendencia, resumenAnterior, nuevosAnterior, empleados, sucursales, horas, recurrencia] = await Promise.all([
    dashboardRepo.findTendencia(filtro, agrupacion),
    dashboardRepo.findResumenPorEstado(filtroAnterior),
    dashboardRepo.countClientesNuevos(filtroAnterior),
    dashboardRepo.findPorEmpleado(filtro),
    dashboardRepo.findPorSucursal(filtro),
    dashboardRepo.findHorasPico(filtro),
    dashboardRepo.findRecurrencia(filtro),
  ]);
  const metricasAnteriores = metricasComparables(resumir(resumenAnterior), nuevosAnterior);

  return {
    tendencia: { agrupacion, puntos: serie(tendencia, periodo, agrupacion) },
    comparacion: {
      periodo_anterior: anterior,
      actual: actual.metricas,
      anterior: metricasAnteriores,
      variacion_pct: Object.fromEntries(
        Object.keys(actual.metricas).map((k) => [k, variacion(actual.metricas[k], metricasAnteriores[k])])
      ),
    },
    por_empleado: empleados.map((row) => ({
      empleado: row.id_empleado ? { id_empleado: row.id_empleado, nombre: row.nombre, apellido: row.apellido } : null,
      ...filaDesempeno(row),
    })),
    por_sucursal: sucursales.map((row) => ({
      sucursal: row.id_sucursal ? { id_sucursal: row.id_sucursal, nombre: row.nombre } : null,
      ...filaDesempeno(row),
    })),
    horas_pico: horas.map((row) => ({ dia_semana: row.dia_semana, hora: row.hora, citas: Number(row.citas) })),
    recurrencia: {
      clientes: Number(recurrencia.clientes),
      recurrentes: Number(recurrencia.recurrentes),
      porcentaje: porcentaje(Number(recurrencia.recurrentes), Number(recurrencia.clientes)),
    },
    cancelaciones: actual.cancelaciones,
  };
};

const SECCIONES_AVANZADAS = ["tendencia", "comparacion", "por_empleado", "por_sucursal", "horas_pico", "recurrencia", "cancelaciones"];

// ---------- Dashboard ----------

/**
 * @param {object} negocio req.negocio
 * @param {{ desde: string, hasta: string, id_sucursal?: number }} query Ya validado (máximo 366 días)
 */
export const getDashboard = async (negocio, { desde, hasta, id_sucursal }) => {
  const { id_negocio } = negocio;
  const filas = await suscripcionRepo.findByNegocio(id_negocio);
  const [{ plan }, planRequerido] = await Promise.all([
    getPlanEfectivo(id_negocio, { suscripciones: filas }),
    dashboardRepo.findPlanConEstadisticas(),
  ]);
  const avanzadas = Boolean(plan.estadisticas_avanzadas);
  const rangoMaximo = avanzadas ? RANGO_AVANZADO_DIAS : RANGO_BASICO_DIAS;
  const dias = diasEntre(desde, hasta) + 1;
  if (dias > rangoMaximo) {
    const requerido = formatPlanRequerido(planRequerido);
    throw ApiError.unprocessable(`Tu plan ${plan.nombre} permite ver hasta ${rangoMaximo} días`, {
      hasta: `El rango máximo es de ${rangoMaximo} días`,
      ...(requerido && { plan_requerido: requerido.nombre }),
    });
  }
  if (id_sucursal !== undefined && !(await citaRepo.perteneceAlNegocio("sucursales", id_sucursal, id_negocio))) {
    throw ApiError.unprocessable("Datos inválidos", { id_sucursal: "No pertenece a este negocio" });
  }

  const hoy = hoyISO();
  const periodo = { desde, hasta, dias };
  const filtro = { id_negocio, desde, hasta, id_sucursal };
  const vencidas = { desde: sumarDias(hoy, -VACUNAS_VENCIDAS_DIAS), hasta: sumarDias(hoy, -1) };
  const [resumenRows, hoyRows, porConfirmar, servicios, clientes_nuevos, calificacion, mascotasVencidas] = await Promise.all([
    dashboardRepo.findResumenPorEstado(filtro),
    dashboardRepo.findHoyPorEstado({ id_negocio, hoy, id_sucursal }),
    dashboardRepo.countPorConfirmar({ id_negocio, hoy, id_sucursal }),
    dashboardRepo.findServiciosMasPedidos(filtro),
    dashboardRepo.countClientesNuevos(filtro),
    dashboardRepo.findCalificacion(filtro),
    dashboardRepo.countMascotasVacunasVencidas({ id_negocio, ...vencidas }),
  ]);
  const resumen = resumir(resumenRows);
  const resumenHoy = resumir(hoyRows);
  const actual = { metricas: metricasComparables(resumen, clientes_nuevos), cancelaciones: resumen.cancelaciones };

  const requerido = formatPlanRequerido(planRequerido);
  const bloqueadas = Object.fromEntries(SECCIONES_AVANZADAS.map((s) => [s, { bloqueado: true, plan_requerido: requerido }]));

  return {
    periodo,
    id_sucursal: id_sucursal ?? null,
    plan: {
      id_plan: plan.id_plan,
      nombre: plan.nombre,
      estadisticas_avanzadas: avanzadas,
      rango_maximo_dias: rangoMaximo,
    },
    // El panel ofrece "Probar Pro" en lugar de "Mejorar plan" (misma regla que la suscripción).
    prueba_disponible: puedeProbar(filas, plan),
    hoy: { fecha: hoy, total: resumenHoy.total, por_estado: resumenHoy.por_estado, por_confirmar: porConfirmar },
    citas: { total: resumen.total, por_estado: resumen.por_estado },
    tasa_inasistencia: {
      porcentaje: resumen.tasa_inasistencia,
      inasistencias: resumen.inasistencias,
      // Completadas más inasistencias: las citas en que el cliente debía llegar.
      base: resumen.completadas + resumen.inasistencias,
    },
    ingresos: formatIngresos(resumen),
    servicios_mas_pedidos: servicios.map((s) => ({
      id_servicio: s.id_servicio,
      nombre: s.nombre,
      completadas: Number(s.completadas),
      ingresos: redondear(Number(s.ingresos)),
    })),
    clientes_nuevos,
    calificacion: {
      promedio: Number(calificacion.calificacion_promedio),
      total_resenas: calificacion.total_resenas,
      resenas_periodo: calificacion.resenas_periodo,
      promedio_periodo: calificacion.promedio_periodo === null ? null : redondear(Number(calificacion.promedio_periodo)),
      sin_responder: calificacion.sin_responder,
    },
    vacunas_vencidas: { mascotas: mascotasVencidas, dias: VACUNAS_VENCIDAS_DIAS, ...vencidas },
    citas_perdidas_por_no_confirmar: citasPerdidas(resumen.cancelaciones.por_sistema, Boolean(calificacion.confirmacion_automatica)),
    avanzadas: avanzadas ? await calcularAvanzadas(filtro, periodo, actual) : bloqueadas,
  };
};
