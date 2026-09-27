import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { TIPOS_NEGOCIO } from "../negocios/negocio.schemas.js";
import { ESPECIES } from "../mascotas/mascota.schemas.js";

export const RADIO_MAX_KM = 50;

const q = z.string().trim().min(1).max(100).optional();
const id = z.coerce.number().int().positive().optional();

const geo = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radio_km: z.coerce.number().positive().max(RADIO_MAX_KM).optional(),
};

/** lat y lng van juntas; radio_km solo tiene sentido con ellas. */
const geoJuntas = (data, ctx) => {
  const conLat = data.lat !== undefined;
  const conLng = data.lng !== undefined;
  if (conLat !== conLng) {
    ctx.addIssue({ code: "custom", path: [conLat ? "lng" : "lat"], message: "lat y lng deben enviarse juntas" });
  }
  if (data.radio_km !== undefined && !conLat && !conLng) {
    ctx.addIssue({ code: "custom", path: ["radio_km"], message: "Requiere lat y lng" });
  }
};

export const buscarNegociosQuery = paginationSchema
  .extend({
    q,
    tipo: z.enum(TIPOS_NEGOCIO, { error: `Debe ser uno de: ${TIPOS_NEGOCIO.join(", ")}` }).optional(),
    id_categoria: id,
    ...geo,
  })
  .superRefine(geoJuntas);

export const buscarServiciosQuery = paginationSchema
  .extend({
    q,
    id_categoria: id,
    id_negocio: id,
    especie: z.enum(ESPECIES, { error: `Debe ser una de: ${ESPECIES.join(", ")}` }).optional(),
    en_oferta: z
      .enum(["true", "false"], { error: "Debe ser true o false" })
      .transform((valor) => valor === "true")
      .optional(),
    ...geo,
  })
  .superRefine(geoJuntas);
