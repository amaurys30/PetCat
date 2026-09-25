import { randomBytes } from "node:crypto";
import * as invitacionRepo from "./invitacion.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import * as negocioRepo from "../negocios/negocio.repository.js";
import { correoInvitacion } from "./invitacion.mail.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { hashToken } from "../../shared/utils/hash.js";
import { sendMail } from "../../shared/utils/mailer.js";
import { isTest } from "../../config/env.js";
import { ApiError } from "../../shared/errors/ApiError.js";

export const VIGENCIA_HORAS = 72;
export const MAX_CORREOS = 4;
export const VENTANA_HORAS = 24;

/**
 * Crea una invitación y envía el correo, todo en una transacción con el empleado
 * bloqueado (dos envíos simultáneos no crean dos invitaciones). Si el correo
 * falla, se deshace y responde 503.
 * - enviar: 409 si ya hay una invitación vigente.
 * - reenviar: 409 si nunca se invitó a ese email; invalida la vigente.
 * En ambos casos, como máximo MAX_CORREOS al mismo email en VENTANA_HORAS.
 */
const emitirInvitacion = async (id_empleado, { reenvio }) =>
  withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn, { forUpdate: true });
    if (!empleado) throw ApiError.notFound("Empleado no encontrado");
    if (!empleado.email) throw ApiError.conflict("El empleado no tiene email: agrégalo antes de invitarlo");
    if (!empleado.activo) throw ApiError.conflict("El empleado está inactivo: reactívalo antes de invitarlo");
    if (empleado.id_usuario) throw ApiError.conflict("El empleado ya tiene una cuenta vinculada");

    const vigente = await invitacionRepo.findVigenteByEmpleado(id_empleado, conn);
    if (!reenvio && vigente) {
      throw ApiError.conflict("El empleado ya tiene una invitación vigente: usa reenviar si no la recibió");
    }
    if (reenvio && !(await invitacionRepo.existsByEmpleadoAndEmail(id_empleado, empleado.email, conn))) {
      throw ApiError.conflict("No hay una invitación previa a este email: usa enviar");
    }

    const { total, libre_desde } = await invitacionRepo.countRecientesByEmail(
      empleado.id_negocio,
      empleado.email,
      VENTANA_HORAS,
      conn
    );
    if (total >= MAX_CORREOS) {
      throw ApiError.conflict(
        `Ya se enviaron ${MAX_CORREOS} invitaciones a este email en las últimas ${VENTANA_HORAS} horas. Podrás volver a enviarla desde ${libre_desde}`
      );
    }

    if (vigente) await invitacionRepo.invalidatePrevious(id_empleado, conn);

    const token = randomBytes(32).toString("hex");
    const invitacion = await invitacionRepo.create(
      {
        id_empleado,
        id_negocio: empleado.id_negocio,
        email: empleado.email,
        token_hash: hashToken(token),
        intentos_reenvio: total,
        horas: VIGENCIA_HORAS,
      },
      conn
    );

    const negocio = await negocioRepo.findById(empleado.id_negocio, conn);
    try {
      await sendMail(
        correoInvitacion({
          token,
          email: empleado.email,
          nombre: empleado.nombre,
          negocio: negocio.nombre,
          rol: empleado.rol_nombre,
          expiracion: invitacion.expiracion,
        })
      );
    } catch (err) {
      if (!isTest) console.error("Error enviando la invitación:", err.message);
      throw ApiError.serviceUnavailable("No se pudo enviar el correo de invitación. Intenta de nuevo en unos minutos");
    }

    // El token solo viaja en el correo: nunca en la respuesta.
    return {
      id_invitacion: invitacion.id_invitacion,
      email: invitacion.email,
      expiracion: invitacion.expiracion,
      envios_restantes_24h: MAX_CORREOS - total - 1,
    };
  });

export const enviarInvitacion = (id_empleado) => emitirInvitacion(id_empleado, { reenvio: false });

export const reenviarInvitacion = (id_empleado) => emitirInvitacion(id_empleado, { reenvio: true });
