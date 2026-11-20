import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClientRestore, persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";

import { queryClient } from "./queryClient";

/**
 * Datos guardados en el teléfono para abrir la app sin red (decisión de M2):
 * - Caché de TanStack Query: solo las consultas de mascotas (lista con su resumen de salud,
 *   detalle y pesos). Vence a las 24 horas y queda ligada a la cuenta (`buster` = id_usuario).
 * - Sesión sin conexión: del usuario, solo su nombre (y el id que liga la caché a su cuenta).
 * Cerrar sesión borra las dos cosas y la mascota seleccionada.
 */

export const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const CLAVE_CACHE = "petcat.cache";
export const CLAVE_SESION_SIN_CONEXION = "petcat.sesion_sin_conexion";

// Un persister por suscripción: su throttle guarda estado (un guardado en espera), que no debe
// pasar de una sesión a otra (ni de una prueba a otra en Jest). Con `activo` en false ignora los
// guardados que quedaron en espera: así cerrar sesión no deja la caché escrita un segundo después.
const nuevoPersister = (activo: () => boolean = () => true) =>
  createAsyncStoragePersister({
    storage: {
      getItem: (clave) => AsyncStorage.getItem(clave),
      setItem: async (clave, valor) => {
        if (activo()) await AsyncStorage.setItem(clave, valor);
      },
      removeItem: (clave) => AsyncStorage.removeItem(clave),
    },
    key: CLAVE_CACHE,
    throttleTime: 1_000,
  });

const opcionesDeUsuario = (id_usuario: number, activo?: () => boolean) => ({
  queryClient,
  persister: nuevoPersister(activo),
  maxAge: VIGENCIA_MS,
  buster: `usuario-${id_usuario}`,
});

/** Carga la caché guardada de esa cuenta (si es de otra o venció, la descarta). */
export async function restaurarCache(id_usuario: number) {
  try {
    await persistQueryClientRestore(opcionesDeUsuario(id_usuario));
  } catch {
    // Una caché ilegible no impide abrir la app.
  }
}

/** Guarda en el teléfono cada cambio de las consultas de mascotas. Devuelve cómo dejar de hacerlo. */
export function suscribirCache(id_usuario: number) {
  detenerCache();
  let activa = true;
  const desuscribir = persistQueryClientSubscribe({
    ...opcionesDeUsuario(id_usuario, () => activa),
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.queryKey[0] === "mascotas" && query.state.status === "success",
    },
  });
  detenerActual = () => {
    activa = false;
    desuscribir();
  };
  return detenerCache;
}

let detenerActual: (() => void) | null = null;

/** Deja de guardar la caché (también los guardados que estaban en espera). */
function detenerCache() {
  detenerActual?.();
  detenerActual = null;
}

export type SesionGuardada = { id_usuario: number; nombre: string; guardado_en: number };

export async function guardarSesionSinConexion(id_usuario: number, nombre: string) {
  const datos: SesionGuardada = { id_usuario, nombre, guardado_en: Date.now() };
  try {
    await AsyncStorage.setItem(CLAVE_SESION_SIN_CONEXION, JSON.stringify(datos));
  } catch {
    // Sin esto solo se pierde poder abrir sin red.
  }
}

/** La sesión guardada para abrir sin red, si tiene menos de 24 horas. */
export async function leerSesionSinConexion(ahora = Date.now()): Promise<SesionGuardada | null> {
  try {
    const texto = await AsyncStorage.getItem(CLAVE_SESION_SIN_CONEXION);
    if (!texto) return null;
    const datos = JSON.parse(texto) as SesionGuardada;
    if (!datos.id_usuario || ahora - datos.guardado_en > VIGENCIA_MS) return null;
    return datos;
  } catch {
    return null;
  }
}

/** Al cerrar sesión: caché, sesión sin conexión y mascota seleccionada. */
export async function borrarDatosGuardados(otrasClaves: string[] = []) {
  detenerCache();
  try {
    await AsyncStorage.multiRemove([CLAVE_CACHE, CLAVE_SESION_SIN_CONEXION, ...otrasClaves]);
  } catch {
    // Mejor esfuerzo: la caché vence sola a las 24 horas.
  }
}
