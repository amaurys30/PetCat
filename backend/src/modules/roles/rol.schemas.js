import { z } from "zod";
import { permisosSchema } from "../../shared/utils/permissions.js";
import { conAlMenosUnCampo, idParam } from "../../shared/utils/schemas.js";

export const idRolParams = idParam("id_rol");

const campos = {
  nombre: z.string().trim().min(2).max(60),
  descripcion: z.string().trim().min(1).max(200).nullable(),
  permisos_json: permisosSchema,
};

export const createRolBody = z.strictObject(campos).partial({ descripcion: true });

export const updateRolBody = conAlMenosUnCampo(z.strictObject(campos).partial());
