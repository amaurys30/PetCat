/**
 * A dónde habla el panel con la API y con Socket.IO.
 *
 * - En desarrollo (`npm run dev` y `npm run dev:red`) siempre por rutas relativas: el proxy de
 *   Vite reenvía `/api` y `/socket.io` a `VITE_API_PROXY_TARGET`. Así funciona igual desde
 *   localhost que desde otro equipo de la red, sin CORS, aunque `.env.local` tenga una URL absoluta.
 * - En el build (producción, `vite preview` y las pruebas de punta a punta) mandan
 *   `VITE_API_URL` (por defecto `/api/v1`) y `VITE_SOCKET_URL` (vacío: el mismo origen).
 */
interface EnvOrigen {
  DEV: boolean;
  VITE_API_URL?: string;
  VITE_SOCKET_URL?: string;
}

export const API_RELATIVA = "/api/v1";

export const urlApi = (env: EnvOrigen = import.meta.env) =>
  env.DEV ? API_RELATIVA : env.VITE_API_URL || API_RELATIVA;

/** `undefined`: Socket.IO se conecta al mismo origen del panel. */
export const origenSocket = (env: EnvOrigen = import.meta.env): string | undefined =>
  env.DEV ? undefined : env.VITE_SOCKET_URL || undefined;
