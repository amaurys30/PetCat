import { z } from "zod";
import { conAlMenosUnCampo, fecha, hora, texto } from "../../shared/utils/schemas.js";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { hoyISO } from "../../shared/utils/fechas.js";

const id = z.number().int().positive();
const idQuery = z.coerce.number().int().positive();

export const ORIGENES_PANEL = ["panel_web", "presencial", "telefono", "whatsapp"];
export const PRIORIDADES = ["normal", "alta", "urgente"];

export const horariosLibresQuery = z.object({
  id_servicio: idQuery,
  id_sucursal: idQuery,
  fecha,
  id_empleado: idQuery.optional(),
});

/** Panel: además, una cita que no ocupa su hora (los horarios para reprogramarla). */
export const horariosLibresPanelQuery = horariosLibresQuery.extend({
  id_cita_excluir: idQuery.optional(),
  /** Sin las horas en que la mascota ya tiene otra cita (en cualquier negocio). */
  id_mascota: idQuery.optional(),
});

const campos = {
  id_servicio: id,
  id_sucursal: id,
  fecha,
  hora_inicio: hora,
  id_mascota: id,
  id_empleado: id.optional(),
  notas_cliente: texto(2000).optional(),
};

/** Reserva desde la app: la mascota debe ser del usuario autenticado. */
export const createCitaBody = z.strictObject(campos);

/** Reserva desde el panel para un cliente (id_usuario) y su mascota. */
export const createCitaPanelBody = z.strictObject({
  ...campos,
  id_usuario: id,
  origen: z.enum(ORIGENES_PANEL, { error: `Debe ser uno de: ${ORIGENES_PANEL.join(", ")}` }).default("panel_web"),
  prioridad: z.enum(PRIORIDADES, { error: `Debe ser una de: ${PRIORIDADES.join(", ")}` }).default("normal"),
  notas_internas: texto(2000).optional(),
});

// ---------- Consultas ----------

export const ESTADOS_CITA = ["pendiente", "confirmada", "en_curso", "completada", "cancelada", "no_asistio", "reprogramada"];
export const MAX_DIAS_AGENDA = 31;

export const idCitaParams = z.object({ id_cita: idQuery });

/** "pendiente,confirmada" -> ["pendiente", "confirmada"], cada uno del catálogo. */
const listaEstados = z
  .string()
  .transform((valor) => [...new Set(valor.split(",").map((e) => e.trim()).filter(Boolean))])
  .pipe(z.array(z.enum(ESTADOS_CITA, { error: `Estados válidos: ${ESTADOS_CITA.join(", ")}` })).min(1));

const booleano = z
  .enum(["true", "false"], { error: "Debe ser true o false" })
  .transform((valor) => valor === "true");

export const misCitasQuery = paginationSchema.extend({
  alcance: z.enum(["proximas", "pasadas", "todas"], { error: "Debe ser proximas, pasadas o todas" }).default("proximas"),
  estado: listaEstados.optional(),
  id_mascota: idQuery.optional(),
});

const diasEntre = (desde, hasta) => (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000;

/** Agenda: desde y hasta por defecto hoy; máximo 31 días. */
export const agendaQuery = z
  .object({
    desde: fecha.optional(),
    hasta: fecha.optional(),
    estado: listaEstados.optional(),
    id_sucursal: idQuery.optional(),
    id_empleado: idQuery.optional(),
    id_servicio: idQuery.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    solo_mias: booleano.optional(),
    fuera_de_disponibilidad: booleano.optional(),
  })
  .transform((q) => {
    const desde = q.desde ?? q.hasta ?? hoyISO();
    return { ...q, desde, hasta: q.hasta ?? desde };
  })
  .superRefine((q, ctx) => {
    if (q.hasta < q.desde) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: "No puede ser anterior a desde" });
    } else if (diasEntre(q.desde, q.hasta) + 1 > MAX_DIAS_AGENDA) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: `El rango máximo es de ${MAX_DIAS_AGENDA} días` });
    }
  });

/** Atención de la agenda: sin rango (desde hoy), con los filtros de la agenda que aplican. */
export const atencionQuery = z.object({
  id_sucursal: idQuery.optional(),
  id_empleado: idQuery.optional(),
  solo_mias: booleano.optional(),
});

// ---------- Cambios ----------

const motivo = texto(300);

export const cambiarEstadoBody = z.strictObject({
  estado: z.enum(["confirmada", "en_curso", "no_asistio", "completada"], {
    error: "Debe ser confirmada, en_curso, no_asistio o completada (para cancelar o reprogramar hay endpoints propios)",
  }),
  motivo: motivo.optional(),
  precio_final: z.number().min(0).max(9999999999.99).optional(),
});

export const cancelarCitaBody = z.strictObject({ motivo: motivo.optional() });

export const reprogramarCitaBody = z.strictObject({
  fecha,
  hora_inicio: hora,
  id_empleado: id.optional(),
  id_sucursal: id.optional(),
  motivo: motivo.optional(),
});

export const actualizarCitaBody = conAlMenosUnCampo(
  z
    .strictObject({
      notas_internas: texto(2000).nullable(),
      prioridad: z.enum(PRIORIDADES, { error: `Debe ser una de: ${PRIORIDADES.join(", ")}` }),
      precio_final: z.number().min(0).max(9999999999.99).nullable(),
      id_empleado: id,
    })
    .partial()
);
