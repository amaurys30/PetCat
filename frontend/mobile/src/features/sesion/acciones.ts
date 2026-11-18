import { getMe, postLogin, postLogout } from "@/api/auth";
import { ApiError, MENSAJES, toApiError } from "@/api/errors";
import { refreshStorage } from "@/api/refreshStorage";
import { cerrarSesionLocal, guardarSesion, renovarSesion } from "@/api/sesion";
import { useSesion } from "@/store/sesion";

/** Tiempo máximo del arranque con sesión guardada: el splash no se queda colgado sin red. */
export const LIMITE_ARRANQUE_MS = 8_000;

export type ResultadoArranque = "autenticada" | "anonima" | "sin_conexion";

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError(0, MENSAJES.tiempo, "tiempo")), ms);
    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Al abrir la app: sin refresh guardado → anónima. Con refresh → renovación silenciosa y perfil
 * (para saber si falta aceptar la política). Si la API rechaza el refresh (401/403), la sesión
 * se cierra; si no hay red, tarda o el servidor falla, se conserva el refresh y se informa
 * `sin_conexion` para reintentar.
 */
export async function restaurarSesion(limiteMs = LIMITE_ARRANQUE_MS): Promise<ResultadoArranque> {
  if (!(await refreshStorage.leer())) {
    useSesion.getState().limpiar();
    return "anonima";
  }
  try {
    await conLimite(renovarSesion(), limiteMs);
    const perfil = await conLimite(getMe(), limiteMs);
    useSesion.getState().setUsuario(perfil);
    useSesion.getState().setRequierePolitica(perfil.requiere_aceptar_politica);
    return "autenticada";
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.tipo === "sesion") return "anonima";
    return "sin_conexion";
  }
}

/**
 * Login: pide el perfil con el token recién recibido y guarda todo junto, así la app pasa una
 * sola vez a su destino (pestañas o aceptar la política). Si el perfil no llega, entra igual:
 * la política se vuelve a revisar en el próximo arranque.
 */
export async function iniciarSesion(email: string, password: string) {
  const sesion = await postLogin(email, password);
  let requierePolitica = false;
  try {
    requierePolitica = (await getMe(sesion.access_token)).requiere_aceptar_politica;
  } catch {
    // Sin perfil no se bloquea la entrada.
  }
  await guardarSesion(sesion);
  useSesion.getState().setRequierePolitica(requierePolitica);
}

/**
 * Cerrar sesión: avisa a la API (máximo 5 s) y, responda o no, borra tokens, estado y caché.
 * Sin red, la sesión del servidor vence sola con su refresh.
 */
export async function cerrarSesion() {
  try {
    await postLogout();
  } catch {
    // La sesión local se cierra igual.
  }
  await cerrarSesionLocal();
}
