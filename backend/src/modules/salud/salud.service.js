import db from "../../config/db.js";
import * as historialRepo from "../historial/historial.repository.js";
import { accesoDueno, accesoNegocio } from "./salud.acceso.js";
import { vacunasConEstado } from "../vacunas/vacuna.service.js";
import { diasEntre } from "../vacunas/vacuna.calculo.js";
import { hoyISO } from "../../shared/utils/fechas.js";
import { toNumber } from "../../shared/utils/format.js";
import { formatMascota } from "../mascotas/mascota.service.js";
import { SELECT_CITA, formatCitaResumen } from "./cita-resumen.js";

const MESES_PESO = 24;
const MAX_PUNTOS_PESO = 24;
const UMBRAL_ESTABLE_PCT = 5;

const restarMeses = (fechaISO, meses) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setMonth(fecha.getMonth() - meses);
  return hoyISO(fecha);
};

// Citas del resumen: para el dueño de cualquier negocio; para un negocio, solo las suyas.
const filtroNegocio = (contexto) => (contexto.tipo === "negocio" ? ["AND c.id_negocio = ?", [contexto.id_negocio]] : ["", []]);

const ultimaCitaCompletada = async (id_mascota, contexto) => {
  const [condicion, valores] = filtroNegocio(contexto);
  const [rows] = await db.query(
    `${SELECT_CITA} WHERE c.id_mascota = ? AND c.estado = 'completada' ${condicion}
     ORDER BY c.fecha DESC, c.hora_inicio DESC LIMIT 1`,
    [id_mascota, ...valores]
  );
  return rows[0];
};

/** Dueño de la mascota (cabecera de la ficha del panel). */
const findDueno = async (id_usuario) => {
  const [rows] = await db.query("SELECT id_usuario, nombre, apellido FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return rows[0];
};

const proximaCita = async (id_mascota, contexto) => {
  const [condicion, valores] = filtroNegocio(contexto);
  const [rows] = await db.query(
    `${SELECT_CITA}
     WHERE c.id_mascota = ? AND c.estado IN ('pendiente', 'confirmada')
       AND (c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_fin >= CURTIME())) ${condicion}
     ORDER BY c.fecha, c.hora_inicio LIMIT 1`,
    [id_mascota, ...valores]
  );
  return rows[0];
};

/** Puntos de peso de los últimos 24 meses (máximo 24), variación entre los dos últimos y tendencia. */
export const evolucionPeso = (registros, pesoActual, hoy) => {
  const desde = restarMeses(hoy, MESES_PESO);
  const puntos = registros
    .filter((r) => r.peso_registro !== null && r.fecha >= desde && r.fecha <= hoy)
    .map((r) => ({ fecha: r.fecha, peso: toNumber(r.peso_registro) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-MAX_PUNTOS_PESO);

  let variacion_kg = null;
  let variacion_pct = null;
  let tendencia = null;
  if (puntos.length >= 2) {
    const [anterior, ultimo] = puntos.slice(-2);
    variacion_kg = Math.round((ultimo.peso - anterior.peso) * 100) / 100;
    variacion_pct = Math.round((variacion_kg / anterior.peso) * 1000) / 10;
    tendencia = Math.abs(variacion_pct) < UMBRAL_ESTABLE_PCT ? "estable" : variacion_kg > 0 ? "sube" : "baja";
  }
  return { peso_actual: toNumber(pesoActual), puntos, variacion_kg, variacion_pct, tendencia };
};

/**
 * Resumen de salud sobre lo visible para quien consulta (ver docs/PLAN.md, 1.6):
 * vacunas vencidas y próximas (de todas las vacunas), último y próximo control y
 * evolución del peso (del historial visible), y la próxima cita.
 */
const resumen = async ({ mascota, contexto }) => {
  const hoy = hoyISO();
  const soloNegocio = contexto.tipo === "negocio" && !contexto.compartir ? contexto.id_negocio : undefined;
  const [vacunas, registros, dueno] = await Promise.all([
    vacunasConEstado(mascota.id_mascota),
    historialRepo.findParaResumen(mascota.id_mascota, soloNegocio),
    findDueno(mascota.id_usuario),
  ]);
  const viva = !mascota.fallecido;

  const vacunas_vencidas = viva
    ? vacunas
        .filter((v) => v.estado === "vencido")
        .sort((a, b) => a.fecha_proxima.localeCompare(b.fecha_proxima))
        .map((v) => ({ ...resumenVacuna(v), dias_vencida: diasEntre(v.fecha_proxima, hoy) }))
    : [];
  const vacunas_proximas = viva
    ? vacunas
        .filter((v) => v.estado === "proximo")
        .sort((a, b) => a.fecha_proxima.localeCompare(b.fecha_proxima))
        .map((v) => ({ ...resumenVacuna(v), dias_restantes: diasEntre(hoy, v.fecha_proxima) }))
    : [];

  const ultimo = registros.find((r) => r.fecha <= hoy);
  let ultimo_control = null;
  if (ultimo) {
    ultimo_control = {
      fuente: "historial",
      id_historial: ultimo.id_historial,
      fecha: ultimo.fecha,
      tipo: ultimo.tipo,
      diagnostico: ultimo.diagnostico,
      negocio: ultimo.id_negocio ? { id_negocio: ultimo.id_negocio, nombre: ultimo.negocio_nombre } : null,
    };
  } else {
    const cita = await ultimaCitaCompletada(mascota.id_mascota, contexto);
    if (cita) ultimo_control = { fuente: "cita", ...formatCitaResumen(cita) };
  }

  const controles = registros.filter((r) => r.proximo_control && r.proximo_control >= hoy);
  const siguiente = controles.sort((a, b) => a.proximo_control.localeCompare(b.proximo_control))[0];
  const proximo_control = siguiente
    ? {
        fecha: siguiente.proximo_control,
        id_historial: siguiente.id_historial,
        negocio: siguiente.id_negocio ? { id_negocio: siguiente.id_negocio, nombre: siguiente.negocio_nombre } : null,
      }
    : null;

  return {
    mascota: formatMascota(mascota),
    dueno,
    vacunas_vencidas,
    vacunas_proximas,
    ultimo_control,
    proximo_control,
    proxima_cita: viva ? (formatCitaResumen(await proximaCita(mascota.id_mascota, contexto)) ?? null) : null,
    evolucion_peso: evolucionPeso(registros, mascota.peso, hoy),
  };
};

const resumenVacuna = (v) => ({
  id_vacuna: v.id_vacuna,
  nombre_vacuna: v.nombre_vacuna,
  fecha_aplicacion: v.fecha_aplicacion,
  fecha_proxima: v.fecha_proxima,
  registrada_por: v.registrada_por,
});

export const getResumenDueno = async (id_usuario, id_mascota) => resumen(await accesoDueno(id_usuario, id_mascota));

export const getResumenNegocio = async (id_negocio, id_mascota) => resumen(await accesoNegocio(id_negocio, id_mascota));
