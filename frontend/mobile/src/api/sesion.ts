import { create } from "axios";

import { env } from "@/lib/env";
import { queryClient } from "@/lib/queryClient";
import { borrarDatosGuardados } from "@/lib/cachePersistente";
import { CLAVE_SELECCION, useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { useSesion } from "@/store/sesion";

import { sesionExpirada, toApiError } from "./errors";
import { refreshStorage } from "./refreshStorage";
import type { Respuesta, SesionApi } from "./types";

// Instancia sin interceptores: el refresh nunca se intercepta a sí mismo.
const http = create({ baseURL: env.apiUrl, timeout: 15_000, headers: { Accept: "application/json" } });

// Una sola renovación en curso. El backend rota el refresh en cada uso y, si dos renovaciones
// llegan a la vez con el mismo token, solo una funciona: la segunda cerraría la sesión. Todas
// las peticiones con 401 esperan esta misma promesa (esa es la cola).
let enCurso: Promise<string> | null = null;

export function renovacionEnCurso() {
  return enCurso;
}

/** Cambia el refresh guardado por un access nuevo. Resuelve con el access token. */
export function renovarSesion(): Promise<string> {
  enCurso ??= renovar().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function renovar(): Promise<string> {
  const refresh = await refreshStorage.leer();
  if (!refresh) {
    await cerrarSesionLocal();
    throw sesionExpirada();
  }

  let sesion: SesionApi;
  try {
    const { data } = await http.post<Respuesta<SesionApi>>("/auth/refresh-token", { refresh_token: refresh });
    sesion = data.data;
  } catch (error) {
    const apiError = toApiError(error);
    // 401/403: el refresh ya no sirve. Error de red o del servidor: se conserva la sesión.
    if (apiError.status === 401 || apiError.status === 403) {
      await cerrarSesionLocal();
      throw sesionExpirada();
    }
    throw apiError;
  }

  await guardarSesion(sesion);
  return sesion.access_token;
}

/**
 * Guarda una sesión recibida de la API (login o refresh). Primero el refresh en SecureStore,
 * por la rotación; después el access en memoria. Si el sistema cierra la app justo entre la
 * rotación en el servidor y esta escritura, el usuario tendrá que iniciar sesión otra vez.
 */
export async function guardarSesion({ access_token, refresh_token, usuario }: SesionApi) {
  await refreshStorage.guardar(refresh_token);
  useSesion.getState().iniciar({ accessToken: access_token, usuario });
}

/**
 * Borra tokens, estado, caché en memoria y lo guardado en el teléfono (caché de mascotas,
 * sesión sin conexión y mascota seleccionada). Ley 1581: nada de datos personales tras salir.
 */
export async function cerrarSesionLocal() {
  await refreshStorage.borrar();
  useSesion.getState().limpiar();
  useMascotaSeleccionada.getState().limpiar();
  queryClient.clear();
  await borrarDatosGuardados([CLAVE_SELECCION]);
}
