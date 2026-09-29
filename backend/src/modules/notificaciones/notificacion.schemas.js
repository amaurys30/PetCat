import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { idParam } from "../../shared/utils/schemas.js";

export const idNotificacionParams = idParam("id_notificacion");

export const listNotificacionesQuery = paginationSchema.extend({
  leidas: z
    .enum(["true", "false"], { error: "Debe ser true o false" })
    .transform((valor) => valor === "true")
    .optional(),
});
