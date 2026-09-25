import * as invitacionService from "./invitacion.service.js";

/**
 * 📩 Enviar invitación
 */
export const sendInvitacion = async (req, res) => {
  try {
    const { id_empleado } = req.params;
    const { id_negocio } = req.query;

    if (!id_empleado || !id_negocio) {
      return res.status(400).json({
        ok: false,
        message: "id_empleado e id_negocio son requeridos"
      });
    }

    const result = await invitacionService.createInvitation(
      Number(id_empleado),
      Number(id_negocio)
    );

    return res.status(200).json({
      ok: true,
      message: "Invitación enviada correctamente",
      data: {
        token: result.token, // ⚠️ en producción NO lo devuelvas
        expiracion: result.expiracion
      }
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error enviando invitación"
    });
  }
};



/**
 * 🔁 Reenviar invitación
 */
export const resendInvitacion = async (req, res) => {
  try {
    const { id_empleado } = req.params;
    const { id_negocio } = req.query;

    if (!id_empleado || !id_negocio) {
      return res.status(400).json({
        ok: false,
        message: "id_empleado e id_negocio son requeridos"
      });
    }

    // 👉 puedes reutilizar createInvitation porque ya invalida anteriores
    const result = await invitacionService.createInvitation(
      Number(id_empleado),
      Number(id_negocio)
    );

    return res.status(200).json({
      ok: true,
      message: "Invitación reenviada correctamente",
      data: {
        expiracion: result.expiracion
      }
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error reenviando invitación"
    });
  }
};



/**
 * ✅ Aceptar invitación
 */
export const acceptInvitacion = async (req, res) => {
  try {
    const { token, password, confirmar_password, nombre, apellido } = req.body;

    if (!token) {
      return res.status(400).json({
        ok: false,
        message: "Token requerido"
      });
    }

    // 🔒 Validación de password
    if (password && password !== confirmar_password) {
      return res.status(400).json({
        ok: false,
        message: "Las contraseñas no coinciden"
      });
    }

    await invitacionService.acceptInvitation(token, password, nombre, apellido);

    return res.status(200).json({
      ok: true,
      message: "Invitación aceptada correctamente"
    });

  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      message: error.message || "Error procesando la invitación"
    });
  }
};