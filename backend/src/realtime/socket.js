import { Server } from "socket.io";
import { env } from "../config/env.js";
import { autenticarToken } from "../shared/middlewares/auth.middleware.js";
import { registrarEmisor } from "../modules/notificaciones/notificacion.service.js";

/**
 * Socket.IO para notificaciones en tiempo real (panel web y app).
 * - El cliente se conecta con `auth: { token: <access token> }`; se valida igual que
 *   authMiddleware (sesión activa y vigente, usuario activo).
 * - Cada socket entra en `usuario:<id>` (lo que se le emite al usuario) y `sesion:<id>`
 *   (para desconectarlo al cerrar esa sesión).
 * - Eventos del servidor:
 *   - `notificacion`: una nueva, con la forma de GET /notificaciones.
 *   - `notificaciones_leidas`: { no_leidas, por_destino: { dueno, negocio } }, al marcar desde
 *     otra sesión del mismo usuario (la app usa `dueno` y el panel `negocio`).
 *   - `agenda_actualizada`: cambio en las citas o la disponibilidad de un negocio, para el
 *     personal con citas.ver (sin citas.ver_todas, solo los de sus citas) y el propietario; no se
 *     guarda (citas/agenda.tiempoReal.js).
 * Un solo proceso en el MVP (sin Redis): las salas viven en memoria.
 */

let io = null;

export const iniciarSocket = (httpServer) => {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      // Igual que la API: sin Origin (app móvil) se permite; en el navegador, solo CORS_ORIGINS.
      origin: (origin, callback) => callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
    },
  });

  io.use(async (socket, next) => {
    try {
      const { user, session } = await autenticarToken(socket.handshake.auth?.token);
      socket.data.id_usuario = user.id_usuario;
      socket.data.id_sesion = session.id_sesion;
      next();
    } catch (err) {
      // El cliente recibe connect_error con este mensaje (p. ej. "Token expirado": renovar y reconectar).
      const error = new Error(err.message ?? "No autenticado");
      error.data = { status: err.status ?? 401 };
      next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(`usuario:${socket.data.id_usuario}`);
    socket.join(`sesion:${socket.data.id_sesion}`);
  });

  registrarEmisor((id_usuario, evento, datos) => io?.to(`usuario:${id_usuario}`).emit(evento, datos));
  return io;
};

/** Desconecta los sockets de una sesión (logout). */
export const desconectarSesion = (id_sesion) => {
  io?.in(`sesion:${id_sesion}`).disconnectSockets(true);
};

/** Desconecta todas las sesiones del usuario salvo `exceptoIdSesion` (cambio o restablecimiento de contraseña). */
export const desconectarSesionesDeUsuario = async (id_usuario, { exceptoIdSesion = null } = {}) => {
  if (!io) return;
  for (const socket of await io.in(`usuario:${id_usuario}`).fetchSockets()) {
    if (socket.data.id_sesion !== exceptoIdSesion) socket.disconnect(true);
  }
};

/** Cierra Socket.IO (tests). */
export const cerrarSocket = async () => {
  if (!io) return;
  await io.close();
  io = null;
};
