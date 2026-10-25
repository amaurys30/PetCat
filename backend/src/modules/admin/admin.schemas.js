import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";

export const ESTADOS_PLAN = ["activa", "en_prueba", "vencida"];

/**
 * Listado de negocios del super admin. `q`: nombre, ciudad o correo del propietario (sin
 * distinguir tildes ni mayúsculas). `id_plan` y `estado`: plan y estado efectivos.
 */
export const negociosAdminQuery = paginationSchema.extend({
  q: z.string().trim().max(100, "Máximo 100 caracteres").optional(),
  id_plan: z.coerce.number().int().positive().optional(),
  estado: z.enum(ESTADOS_PLAN, { error: `Debe ser ${ESTADOS_PLAN.join(", ")}` }).optional(),
});
