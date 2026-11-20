import { getMe, postLogin, postLogout } from "@/api/auth";
import { ApiError, MENSAJES, toApiError } from "@/api/errors";
import { refreshStorage } from "@/api/refreshStorage";
import { cerrarSesionLocal, guardarSesion, renovarSesion } from "@/api/sesion";
import { guardarSesionSinConexion, leerSesionSinConexion, restaurarCache } from "@/lib/cachePersistente";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useSesion } from "@/store/sesion";

/** Tiempo máximo del arranque con sesión guardada: el splash no se queda colgado sin red. */
export const LIMITE_ARRANQUE_MS = 8_000;

/** `sin_conexion_con_datos`: sin red, pero con datos guardados de la cuenta: se entra en modo sin conexión. */
export type ResultadoArranque = "autenticada" | "anonima" | "sin_conexion" | "sin_conexion_con_datos";

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
 * Al abrir la app (y al reconectar): sin refresh guardado → anónima. Con refresh → renovación
 * silenciosa y perfil (para saber si falta aceptar la política); la caché guardada de la cuenta
 * se carga para mostrar algo al instante. Si la API rechaza el refresh (401/403), la sesión se
 * cierra. Si no hay red, tarda o el servidor falla, se conserva el refresh: con datos guardados
 * de la cuenta (menos de 24 h) se entra sin conexión; si no, `sin_conexion` para reintentar.
 */
export async function restaurarSesion(limiteMs = LIMITE_ARRANQUE_MS): Promise<ResultadoArranque> {
  if (!(await refreshStorage.leer())) {
    useSesion.getState().limpiar();
    return "anonima";
  }
  try {
    await conLimite(renovarSesion(), limiteMs);
    const perfil = await conLimite(getMe(), limiteMs);
    const sesion = useSesion.getState();
    if (sesion.sinConexion && sesion.sinConexion.id_usuario !== perfil.id_usuario) queryClient.clear();
    sesion.setUsuario(perfil);
    sesion.setRequierePolitica(perfil.requiere_aceptar_politica);
    await guardarSesionSinConexion(perfil.id_usuario, perfil.nombre);
    if (!sesion.modoSinConexion) await restaurarCache(perfil.id_usuario);
    return "autenticada";
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.tipo === "sesion") return "anonima";
    // Ya estaba sin conexión (reintento): sigue igual.
    if (useSesion.getState().modoSinConexion) return "sin_conexion_con_datos";
    const guardada = await leerSesionSinConexion();
    if (guardada) {
      await restaurarCache(guardada.id_usuario);
      if (queryClient.getQueryData(queryKeys.mascotas.lista())) {
        useSesion.getState().entrarSinConexion(guardada);
        return "sin_conexion_con_datos";
      }
    }
    return "sin_conexion";
  }
}

/** Reintento desde el aviso "Sin conexión" o al volver la red: actualiza los datos si entra. */
export async function reconectar() {
  const resultado = await restaurarSesion();
  // Sin esperar: las pantallas muestran lo guardado mientras se actualiza.
  if (resultado === "autenticada")
    void queryClient.invalidateQueries({ queryKey: queryKeys.mascotas.todas() });
  return resultado;
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
  await guardarSesionSinConexion(sesion.usuario.id_usuario, sesion.usuario.nombre);
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
