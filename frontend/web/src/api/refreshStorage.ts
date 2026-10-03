/**
 * Dónde vive el refresh token. Con "Recordarme" va en localStorage (sobrevive al
 * cerrar el navegador); sin él, en sessionStorage de cada pestaña, y las pestañas
 * abiertas se lo pasan por BroadcastChannel (ver sesion.ts).
 * Deuda del MVP: a futuro, cookie httpOnly emitida por la API.
 */
const CLAVE = "petcat.refresh_token";

export interface RefreshGuardado {
  token: string;
  recordar: boolean;
}

const leerDe = (storage: Storage): string | null => {
  try {
    return storage.getItem(CLAVE);
  } catch {
    return null;
  }
};

const quitarDe = (storage: Storage) => {
  try {
    storage.removeItem(CLAVE);
  } catch {
    // El navegador bloquea el almacenamiento: no hay nada que quitar.
  }
};

export function leerRefresh(): RefreshGuardado | null {
  const local = leerDe(localStorage);
  if (local) return { token: local, recordar: true };
  const sesion = leerDe(sessionStorage);
  return sesion ? { token: sesion, recordar: false } : null;
}

export function guardarRefresh(token: string, recordar: boolean) {
  const [destino, otro] = recordar ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
  try {
    destino.setItem(CLAVE, token);
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña (el token sigue en memoria).
  }
  quitarDe(otro);
}

export function borrarRefresh() {
  quitarDe(localStorage);
  quitarDe(sessionStorage);
}
