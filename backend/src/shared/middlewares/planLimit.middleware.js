import { RECURSOS_CON_LIMITE, verificarLimite } from "../../modules/suscripciones/suscripcion.service.js";

/**
 * Límites del plan (regla de dominio 3): 403 con `errors.plan` si el negocio ya usa
 * todo lo que su plan permite de `recurso` ("sucursales", "empleados" o "productos").
 * Va después de `authorize` (usa `req.negocio`). Es la comprobación rápida, sin
 * bloqueos: el servicio la repite dentro de su transacción con las suscripciones
 * bloqueadas (`bloquearYVerificarLimite`) para que dos altas simultáneas no pasen del límite.
 *
 *   router.post("/negocios/:id_negocio/sucursales", authMiddleware, validate(...),
 *     authorize("configuracion", "editar"), checkPlanLimit("sucursales"), controller.create);
 */
export const checkPlanLimit = (recurso) => {
  if (!RECURSOS_CON_LIMITE.includes(recurso)) {
    throw new Error(`checkPlanLimit: recurso "${recurso}" sin límite de plan`);
  }
  // eslint-disable-next-line no-unused-vars
  return async (req, res, next) => {
    await verificarLimite(req.negocio.id_negocio, recurso);
    next();
  };
};

export default checkPlanLimit;
