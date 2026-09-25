export const authorize = (modulo, accion) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      // 🔹 1. ADMIN GLOBAL (acceso total)
      if (user.tipo_usuario === "admin") {
        return next();
      }

      // 🔹 2. CLIENTE (no tiene permisos internos)
      if (user.tipo_usuario === "cliente") {
        return res.status(403).json({
          message: "No tienes permisos para esta acción",
        });
      }

      // 🔹 3. NEGOCIO → validar permisos del rol
      const permisos = user.permisos;

      if (!permisos) {
        return res.status(403).json({
          message: "No tienes permisos asignados",
        });
      }

      const accionesModulo = permisos[modulo];

      if (!accionesModulo || !accionesModulo.includes(accion)) {
        return res.status(403).json({
          message: `No autorizado para ${accion} en ${modulo}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Error en autorización",
      });
    }
  };
};