import * as saludRepo from "./salud.repository.js";
import { formatCitaResumen } from "./cita-resumen.js";
import { calcularEstados, diasEntre } from "../vacunas/vacuna.calculo.js";
import { diasAvisoVacuna } from "../vacunas/vacuna.service.js";
import { hoyISO } from "../../shared/utils/fechas.js";

/**
 * Resumen corto de salud de varias mascotas del mismo dueño, para las listas de la app
 * (`GET /mascotas?incluir=resumen`). Se calcula en lote: tres consultas en total, sin
 * importar cuántas mascotas haya. Mismas reglas que GET /mascotas/:id/resumen-salud:
 * - Vacunas: solo la dosis vigente de cada una cuenta (calcularEstados); `proximo` es dentro
 *   de `dias_aviso_vacuna` días (30 por defecto).
 * - Próximos eventos: vacunas vencidas o próximas y controles (o desparasitaciones) de los
 *   próximos `dias_aviso_vacuna` días; máximo 5, del más cercano al más lejano.
 * - Próxima cita: la pendiente o confirmada más cercana que no ha terminado, de cualquier negocio.
 * Solo para el dueño: un negocio no recibe este resumen (vería citas de otros negocios).
 * Una mascota fallecida no tiene estado de vacunas, eventos ni cita.
 */

export const MAX_EVENTOS = 5;

const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const agrupar = (filas) => {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila.id_mascota)) grupos.set(fila.id_mascota, []);
    grupos.get(fila.id_mascota).push(fila);
  }
  return grupos;
};

const estadoVacunas = ({ vigentes, proximas, vencidas }) => {
  if (vencidas > 0) return "vencido";
  if (proximas > 0) return "proximo";
  if (vigentes > 0) return "al_dia";
  return "sin_vacunas";
};

const resumenDe = (mascota, vacunas, controles, cita, { hoy, dias }) => {
  const estados = calcularEstados(vacunas, hoy, dias);
  const vigentes = vacunas.filter((v) => estados.get(v.id_vacuna) !== "no_aplica");
  const conteo = {
    vigentes: vigentes.length,
    al_dia: vigentes.filter((v) => estados.get(v.id_vacuna) === "al_dia").length,
    proximas: vigentes.filter((v) => estados.get(v.id_vacuna) === "proximo").length,
    vencidas: vigentes.filter((v) => estados.get(v.id_vacuna) === "vencido").length,
  };

  if (mascota.fallecido) {
    return { estado_vacunas: null, vacunas: conteo, proximos_eventos: [], proxima_cita: null };
  }

  const eventos = [
    ...vigentes
      .filter((v) => ["vencido", "proximo"].includes(estados.get(v.id_vacuna)))
      .map((v) => ({
        tipo: "vacuna",
        titulo: v.nombre_vacuna,
        fecha: v.fecha_proxima,
        dias: diasEntre(hoy, v.fecha_proxima),
        id_vacuna: v.id_vacuna,
        id_historial: null,
        negocio: null,
      })),
    ...controles.map((c) => ({
      tipo: c.tipo === "desparasitacion" ? "desparasitacion" : "control",
      titulo: c.tipo === "desparasitacion" ? "Desparasitación" : "Control",
      fecha: c.proximo_control,
      dias: diasEntre(hoy, c.proximo_control),
      id_vacuna: null,
      id_historial: c.id_historial,
      negocio: c.id_negocio ? { id_negocio: c.id_negocio, nombre: c.negocio_nombre } : null,
    })),
  ]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, MAX_EVENTOS);

  return {
    estado_vacunas: estadoVacunas(conteo),
    vacunas: conteo,
    proximos_eventos: eventos,
    proxima_cita: formatCitaResumen(cita) ?? null,
  };
};

/** Map id_mascota → resumen para las mascotas dadas (todas del mismo dueño, ya verificado). */
export const resumenesDeMascotas = async (mascotas) => {
  const resumenes = new Map();
  if (mascotas.length === 0) return resumenes;

  const ids = mascotas.map((m) => m.id_mascota);
  const hoy = hoyISO();
  const dias = await diasAvisoVacuna();
  const [vacunas, controles, citas] = await Promise.all([
    saludRepo.findVacunasDeMascotas(ids),
    saludRepo.findControlesDeMascotas(ids, hoy, sumarDias(hoy, dias)),
    saludRepo.findProximasCitasDeMascotas(ids),
  ]);
  const vacunasPor = agrupar(vacunas);
  const controlesPor = agrupar(controles);
  const citaPor = new Map(citas.map((c) => [c.id_mascota, c]));

  for (const m of mascotas) {
    resumenes.set(
      m.id_mascota,
      resumenDe(m, vacunasPor.get(m.id_mascota) ?? [], controlesPor.get(m.id_mascota) ?? [], citaPor.get(m.id_mascota), {
        hoy,
        dias,
      })
    );
  }
  return resumenes;
};
