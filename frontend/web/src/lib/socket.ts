import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { origenSocket } from "@/api/origen";
import { getAccessToken, renovarSesion } from "@/api/sesion";

/**
 * Conexión de Socket.IO de la sesión (una por pestaña).
 *
 * - Se autentica con el access token vigente en cada intento: `auth` es una función, así
 *   que una reconexión usa el token renovado, propio o de otra pestaña.
 * - Si la API la rechaza por el token (401, p. ej. "Token expirado"), renueva la sesión y
 *   vuelve a conectar; si la renovación falla, la sesión se cierra (stores/auth) y con
 *   ella la conexión. Otros rechazos (cuenta desactivada) se reintentan cada minuto.
 * - Una caída de la red la reintenta Socket.IO solo.
 * - Al cerrar sesión se cierra; con otra cuenta se abre una nueva.
 */

/** "cerrado": sin sesión o todavía sin abrir; "desconectado": se perdió o se rechazó y se reintenta. */
export type EstadoConexion = "cerrado" | "conectando" | "conectado" | "desconectado";

const REINTENTO_RECHAZO_MS = 60_000;

/** Servidor de Socket.IO: en desarrollo el mismo origen (proxy); en el build, VITE_SOCKET_URL o el mismo origen. */
const origen = origenSocket();

let socket: Socket | null = null;
let idUsuarioSocket: number | null = null;
let estado: EstadoConexion = "cerrado";
let reintento: ReturnType<typeof setTimeout> | null = null;
const oyentes = new Set<() => void>();

function cambiarEstado(nuevo: EstadoConexion) {
  if (nuevo === estado) return;
  estado = nuevo;
  oyentes.forEach((oyente) => oyente());
}

export function getEstadoConexion() {
  return estado;
}

export function suscribirEstadoConexion(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function getSocket() {
  return socket;
}

/** Abre la conexión del usuario (si ya hay una de otro usuario, la cierra antes). */
export function conectarSocket(idUsuario: number): Socket {
  if (socket && idUsuarioSocket === idUsuario) return socket;
  cerrarSocket();

  const nuevo = io(origen, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  socket = nuevo;
  idUsuarioSocket = idUsuario;
  cambiarEstado("conectando");

  // Renueva una sola vez por conexión lograda: si el token nuevo también se rechaza, no insiste.
  let renovado = false;
  nuevo.on("connect", () => {
    renovado = false;
    cambiarEstado("conectado");
  });
  nuevo.on("disconnect", () => cambiarEstado(nuevo.active ? "conectando" : "desconectado"));
  nuevo.on("connect_error", (error: Error & { data?: { status?: number } }) => {
    cambiarEstado("desconectado");
    // Error de red: Socket.IO reintenta solo. Rechazo del servidor: hay que volver a llamar connect().
    if (nuevo.active) return;
    if (error.data?.status === 401 && !renovado) {
      renovado = true;
      renovarSesion()
        .then(() => socket === nuevo && nuevo.connect())
        .catch(() => undefined);
      return;
    }
    reintento = setTimeout(() => socket === nuevo && nuevo.connect(), REINTENTO_RECHAZO_MS);
  });
  return nuevo;
}

export function cerrarSocket() {
  if (reintento) clearTimeout(reintento);
  reintento = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  idUsuarioSocket = null;
  cambiarEstado("cerrado");
}

/** Estado de la conexión para la interfaz (aviso "Sin actualización en tiempo real"). */
export function useEstadoConexion(): EstadoConexion {
  return useSyncExternalStore(suscribirEstadoConexion, getEstadoConexion);
}
