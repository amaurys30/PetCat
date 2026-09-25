import { verifyToken } from "../utils/jwt.js";
import * as sessionRepo from "../../modules/sessions/session.repository.js";
import * as empleadoRepo from "../../modules/empleados/empleado.repository.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    const session = await sessionRepo.findSessionByToken(token);

    if (!session || session.activa === 0) {
    return res.status(401).json({ message: "Sesión inválida o expirada" });
    }

    // 🔥 NUEVO: traer rol si es usuario tipo negocio
    let permisos = null;

    if (decoded.tipo_usuario === "negocio") {
      const empleado = await empleadoRepo.findByUserId(decoded.id_usuario);

      if (empleado && empleado.rol) {
        permisos = empleado.rol.permisos_json;
      }
    }

    req.user = {
      ...decoded,
      permisos, // 👈 aquí viajan los permisos
    };

    req.session = session;

    next();
  } catch (err) {
    console.error("Error en authMiddleware:", err.message); // Esto te dirá si es 'jwt expired' o 'invalid signature'
    return res.status(401).json({ message: "Token inválido" });
  }
};
