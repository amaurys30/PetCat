import { destinatariosDelNegocio, emitirAUsuario } from "../notificaciones/notificacion.service.js";

/**
 * Tiempo real de la agenda: `agenda_actualizada` por Socket.IO, después del commit, a cada
 * usuario con `citas.ver` del negocio y al propietario, incluido quien hizo el cambio (para
 * sus otras pestañas). No se guarda: el panel vuelve a pedir lo que muestra. Los permisos se
 * calculan al emitir, así que un cambio de rol aplica de inmediato. `empleados`: profesionales
 * afectados (los de la cita, antes y después del cambio, o el de la disponibilidad); quien no
 * tiene citas.ver_todas solo recibe los suyos. Sin `empleados` (horario de una sucursal), todos.
 *
 * Datos: { id_negocio, accion, id_cita?, id_cita_nueva?, id_empleado?, id_sucursal?, fechas,
 * por, cita? }.
 * - accion: reserva_app (nueva desde la app), creada (desde el panel), estado, cancelada,
 *   reprogramada, editada o disponibilidad (cambió lo que define "fuera de disponibilidad").
 * - por: id_usuario de quien hizo el cambio (null: el sistema). El panel no avisa sus propios cambios.
 * - cita: solo en reserva_app, para el aviso flotante (mascota, servicio, fecha, hora y estado).
 */
export const EVENTO_AGENDA = "agenda_actualizada";

/** Nunca lanza: el cambio ya se guardó y el aviso es solo para refrescar pantallas. */
export const avisarAgenda = async (id_negocio, cambio, { empleados } = {}) => {
  try {
    const destinatarios = await destinatariosDelNegocio(id_negocio, ["citas", "ver"], undefined, { deCitas: empleados });
    const datos = { id_negocio, fechas: [], por: null, ...cambio };
    for (const id_usuario of new Set(destinatarios.map((d) => d.id_usuario))) {
      emitirAUsuario(id_usuario, EVENTO_AGENDA, datos);
    }
  } catch (err) {
    console.error(`[agenda] No se pudo avisar el cambio (${cambio.accion}) del negocio ${id_negocio}:`, err.message);
  }
};
