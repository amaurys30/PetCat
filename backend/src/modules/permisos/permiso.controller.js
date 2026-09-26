import { CATALOGO_PERMISOS } from "../../shared/utils/permissions.js";
import { ok } from "../../shared/utils/response.js";

export const getCatalogo = (req, res) => ok(res, CATALOGO_PERMISOS);
