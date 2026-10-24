import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { idParam } from "../../shared/utils/schemas.js";

export const idNotificacionParams = idParam("id_notificacion");

export const DESTINOS = ["dueno", "negocio"];

/** `destino`: solo las de la app del dueño o solo las del panel; sin él, todas. */
export const destinoQuery = z.object({
  destino: z.enum(DESTINOS, { error: `Debe ser ${DESTINOS.join(" o ")}` }).optional(),
});

export const listNotificacionesQuery = paginationSchema.extend({
  ...destinoQuery.shape,
  leidas: z
    .enum(["true", "false"], { error: "Debe ser true o false" })
    .transform((valor) => valor === "true")
    .optional(),
});
