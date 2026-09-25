import * as empleadoRepo from "../../modules/empleados/empleado.repository.js";
import * as negocioRepo from "../../modules/negocios/negocio.repository.js";
import * as rolRepo from "../../modules/roles/rol.repository.js";
import * as sucursalRepo from "../../modules/sucursales/sucursal.repository.js";
import { hasPermission } from "../utils/permissions.js";

export const authorize = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      let { id_negocio } = req.params;

      /*
      =========================================================
      1. ADMIN GLOBAL → acceso total
      =========================================================
      */
      if (user.tipo_usuario === "admin") {
        return next();
      }

      /*
      =========================================================
      2. Si no viene id_negocio pero sí id_empleado,
         obtener negocio automáticamente
      =========================================================
      */
      if (!id_negocio && req.params.id_empleado) {
        const empleadoTarget = await empleadoRepo.findById(
          req.params.id_empleado
        );

        if (!empleadoTarget) {
          return res.status(404).json({
            ok: false,
            message: "Empleado no encontrado",
          });
        }

        id_negocio = empleadoTarget.id_negocio;
        req.empleadoTarget = empleadoTarget;
      }


      /*
      =========================================================
      3. Resolver negocio desde id_sucursal
      =========================================================
      */
      if (!id_negocio && req.params.id_sucursal) {
        const sucursal = await sucursalRepo.findById(
          req.params.id_sucursal
        );

        if (!sucursal) {
          return res.status(404).json({
            ok: false,
            message: "Sucursal no encontrada",
          });
        }

        id_negocio = sucursal.id_negocio;
        req.sucursal = sucursal;
      }

      /*
      =========================================================
      3. Validar que exista id_negocio
      =========================================================
      */
      if (!id_negocio) {
        return res.status(400).json({
          ok: false,
          message: "Debe especificar un negocio válido",
        });
      }

      /*
      =========================================================
      4. Buscar negocio
      =========================================================
      */
      const negocio = await negocioRepo.findById(id_negocio);

      if (!negocio) {
        return res.status(404).json({
          ok: false,
          message: "Negocio no encontrado",
        });
      }

      /*
      =========================================================
      5. Propietario del negocio → acceso total
      =========================================================
      */
      if (negocio.id_usuario_propietario === user.id_usuario) {
        req.negocio = negocio;
        return next();
      }

      /*
      =========================================================
      6. Buscar empleado dentro de ESE negocio
      =========================================================
      */
      const empleado = await empleadoRepo.findByUserAndNegocio(
        user.id_usuario,
        id_negocio
      );

      if (!empleado) {
        return res.status(403).json({
          ok: false,
          message: "No perteneces a este negocio",
        });
      }

      /*
      =========================================================
      7. Obtener rol asignado
      =========================================================
      */
      const rol = await rolRepo.findById(empleado.id_rol);

      if (!rol) {
        return res.status(403).json({
          ok: false,
          message: "Rol no válido",
        });
      }

      /*
      =========================================================
      8. Validar permisos JSON
      =========================================================
      */
      const allowed = hasPermission(
        rol.permisos_json,
        modulo,
        accion
      );

      if (!allowed) {
        return res.status(403).json({
          ok: false,
          message: "No tienes permisos para esta acción",
        });
      }

      /*
      =========================================================
      9. Guardar contexto
      =========================================================
      */
      req.negocio = negocio;
      req.empleado = empleado;
      req.rol = rol;

      next();

    } catch (error) {
      console.error("ERROR AUTHORIZE:", error);

      return res.status(500).json({
        ok: false,
        message: "Error validando permisos",
        error: error.message,
      });
    }
  };
};