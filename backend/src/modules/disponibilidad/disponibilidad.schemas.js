import { z } from "zod";
import { conAlMenosUnCampo, fecha, hora, idParam, texto } from "../../shared/utils/schemas.js";
import { hoyISO } from "../../shared/utils/fechas.js";

export const TIPOS_EXCEPCION = ["bloqueo", "vacacion", "evento_especial"];
export const MAX_DIAS_PERIODO = 366;

export const idEmpleadoParams = idParam("id_empleado");
export const idDisponibilidadParams = idParam("id_disponibilidad");

const idSucursal = z.number().int().positive();
const motivo = texto(200).nullable();

// ---------- Horario semanal (PUT) ----------

const rangoSemanal = z
  .strictObject({
    dia_semana: z.int().min(0).max(6),
    hora_inicio: hora,
    hora_fin: hora,
    id_sucursal: idSucursal.nullable().default(null),
  })
  .refine((r) => r.hora_fin > r.hora_inicio, { path: ["hora_fin"], message: "Debe ser posterior a hora_inicio" });

/**
 * El `horario_normal` completo del empleado. Lista vacía = sigue el horario de
 * la sucursal. Los rangos de un mismo día no se cruzan (tampoco entre sucursales).
 */
export const putHorarioSemanalBody = z.strictObject({
  horarios: z.array(rangoSemanal).max(42),
});

// ---------- Excepciones con fecha ----------

const diasEntre = (desde, hasta) => (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000;

/** Reglas comunes: período (fecha_fin) y rango de horas (hora_fin > hora_inicio, ambas o ninguna). */
const reglasComunes = (data, ctx) => {
  if (data.fecha_fin) {
    if (data.fecha_fin < data.fecha_especifica) {
      ctx.addIssue({ code: "custom", path: ["fecha_fin"], message: "No puede ser anterior a fecha_especifica" });
    } else if (diasEntre(data.fecha_especifica, data.fecha_fin) + 1 > MAX_DIAS_PERIODO) {
      ctx.addIssue({ code: "custom", path: ["fecha_fin"], message: `El período no puede superar ${MAX_DIAS_PERIODO} días` });
    }
  }
  const conInicio = Boolean(data.hora_inicio);
  const conFin = Boolean(data.hora_fin);
  if (conInicio !== conFin) {
    ctx.addIssue({ code: "custom", path: [conInicio ? "hora_fin" : "hora_inicio"], message: "hora_inicio y hora_fin van juntas" });
  } else if (conInicio && data.hora_fin <= data.hora_inicio) {
    ctx.addIssue({ code: "custom", path: ["hora_fin"], message: "Debe ser posterior a hora_inicio" });
  }
};

/** Al crear: el último día no puede estar en el pasado. */
const noPasada = (data, ctx) => {
  const ultimo = data.fecha_fin ?? data.fecha_especifica;
  if (ultimo < hoyISO()) {
    ctx.addIssue({
      code: "custom",
      path: [data.fecha_fin ? "fecha_fin" : "fecha_especifica"],
      message: "La excepción ya pasó: el último día debe ser hoy o posterior",
    });
  }
};

/** Campos de cada tipo. Los que no están en su esquema dan "Campo no permitido". */
const camposPorTipo = {
  bloqueo: {
    tipo: z.literal("bloqueo"),
    fecha_especifica: fecha,
    fecha_fin: fecha.nullable().default(null),
    hora_inicio: hora.nullable().default(null),
    hora_fin: hora.nullable().default(null),
    motivo: motivo.default(null),
  },
  vacacion: {
    tipo: z.literal("vacacion"),
    fecha_especifica: fecha,
    fecha_fin: fecha.nullable().default(null),
    motivo: motivo.default(null),
  },
  evento_especial: {
    tipo: z.literal("evento_especial"),
    fecha_especifica: fecha,
    hora_inicio: hora,
    hora_fin: hora,
    id_sucursal: idSucursal,
    motivo: motivo.default(null),
  },
};

/** Esquema de una excepción de ese tipo; `alCrear` agrega la regla de no estar en el pasado. */
export const excepcionSchema = (tipo, { alCrear = false } = {}) => {
  const base = z.strictObject(camposPorTipo[tipo]).superRefine(reglasComunes);
  return alCrear ? base.superRefine(noPasada) : base;
};

/** Columnas que tiene cada tipo (para combinar la fila actual con un PATCH). */
export const COLUMNAS_POR_TIPO = Object.fromEntries(
  Object.entries(camposPorTipo).map(([tipo, campos]) => [tipo, Object.keys(campos)])
);

export const createExcepcionBody = z.discriminatedUnion(
  "tipo",
  TIPOS_EXCEPCION.map((tipo) => excepcionSchema(tipo, { alCrear: true })),
  { error: `Debe ser uno de: ${TIPOS_EXCEPCION.join(", ")}` }
);

/**
 * PATCH de una excepción: el tipo no cambia. El servicio combina el body con la
 * fila actual y lo valida con el esquema de su tipo.
 */
export const updateExcepcionBody = conAlMenosUnCampo(
  z
    .strictObject({
      fecha_especifica: fecha,
      fecha_fin: fecha.nullable(),
      hora_inicio: hora.nullable(),
      hora_fin: hora.nullable(),
      id_sucursal: idSucursal,
      motivo,
    })
    .partial()
);

export const listDisponibilidadQuery = z
  .object({
    desde: fecha.optional(),
    hasta: fecha.optional(),
    tipo: z.enum(TIPOS_EXCEPCION, { error: `Debe ser uno de: ${TIPOS_EXCEPCION.join(", ")}` }).optional(),
  })
  .refine((q) => !q.desde || !q.hasta || q.hasta >= q.desde, { path: ["hasta"], message: "No puede ser anterior a desde" });

export const disponibilidadEfectivaQuery = z.object({
  fecha,
  id_sucursal: z.coerce.number().int().positive().optional(),
});
