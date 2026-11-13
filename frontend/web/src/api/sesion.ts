import axios from "axios";
import { ApiError, toApiError } from "./errors";
import { borrarRefresh, guardarRefresh, leerRefresh } from "./refreshStorage";
import type { Respuesta } from "./types";

/**
 * Tokens de la sesión, compartidos entre pestañas.
 *
 * - El access token vive solo en memoria. El refresh token, en refreshStorage.
 * - La API rota el refresh token en cada uso: si dos renovaciones usan el mismo, la
 *   segunda falla. Por eso:
 *   1. Dentro de una pestaña, las renovaciones simultáneas comparten una sola promesa.
 *   2. Entre pestañas, `navigator.locks` deja renovar a una a la vez.
 *   3. La pestaña que renueva avisa a las demás por BroadcastChannel con los tokens
 *      nuevos; la que esperaba el candado ve que la versión cambió y usa esos tokens
 *      sin volver a renovar.
 *   4. Una pestaña recién cargada (sin access token) pide primero los tokens a las
 *      abiertas y solo renueva si ninguna responde. Si la renovación da 401 porque otra
 *      pestaña rotó el token, reintenta con el guardado, y nunca borra el de otra pestaña.
 * - Las pestañas también se avisan el inicio y el cierre de sesión, y una pestaña
 *   nueva sin refresh token propio (sesión sin "Recordarme") se lo pide a las abiertas.
 */

export const API_URL = import.meta.env.VITE_API_URL || "/api/v1";
const CANDADO = "petcat-renovar-sesion";
const TIEMPO_RESPUESTA_PESTANAS_MS = 250;

type Mensaje =
  | { tipo: "tokens"; access: string; refresh: string; recordar: boolean }
  | { tipo: "cierre" }
  | { tipo: "perfil" }
  | { tipo: "pedir" }
  | { tipo: "respuesta"; access: string; refresh: string; recordar: boolean };

export type EventoSesion =
  /** Otra pestaña inició sesión o renovó los tokens. */
  | { tipo: "tokens-externos" }
  /** Otra pestaña cambió el perfil (nombre, foto): hay que recargarlo. */
  | { tipo: "perfil-externo" }
  /** La sesión terminó: cierre en otra pestaña o renovación imposible (vencida o revocada). */
  | { tipo: "cerrada"; motivo: "otra-pestana" | "expirada" };

let accessToken: string | null = null;
let refreshEnMemoria: { token: string; recordar: boolean } | null = null;
/** Sube con cada cambio de tokens, propio o de otra pestaña. */
let version = 0;
let renovacionEnCurso: Promise<string> | null = null;

const oyentes = new Set<(evento: EventoSesion) => void>();
const emitir = (evento: EventoSesion) => oyentes.forEach((oyente) => oyente(evento));

export function suscribirSesion(oyente: (evento: EventoSesion) => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

const canal: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("petcat-sesion");
const publicar = (mensaje: Mensaje) => canal?.postMessage(mensaje);

let esperandoRespuesta: ((m: Extract<Mensaje, { tipo: "respuesta" }>) => void) | null = null;

function aplicarTokens(access: string, refresh: string, recordar: boolean) {
  accessToken = access;
  refreshEnMemoria = { token: refresh, recordar };
  guardarRefresh(refresh, recordar);
  version += 1;
}

if (canal) {
  canal.onmessage = (evento: MessageEvent<Mensaje>) => {
    const mensaje = evento.data;
    switch (mensaje.tipo) {
      case "tokens":
        aplicarTokens(mensaje.access, mensaje.refresh, mensaje.recordar);
        emitir({ tipo: "tokens-externos" });
        break;
      case "perfil":
        emitir({ tipo: "perfil-externo" });
        break;
      case "cierre":
        borrarLocal();
        emitir({ tipo: "cerrada", motivo: "otra-pestana" });
        break;
      case "pedir":
        if (accessToken && refreshEnMemoria) {
          publicar({
            tipo: "respuesta",
            access: accessToken,
            refresh: refreshEnMemoria.token,
            recordar: refreshEnMemoria.recordar,
          });
        }
        break;
      case "respuesta":
        esperandoRespuesta?.(mensaje);
        break;
    }
  };
}

/**
 * Borra los tokens de esta pestaña. Con `soloSiGuardado`, el almacenamiento se borra solo si
 * todavía guarda ese token (no el que otra pestaña acaba de dejar).
 */
function borrarLocal({ soloSiGuardado }: { soloSiGuardado?: string } = {}) {
  accessToken = null;
  refreshEnMemoria = null;
  if (soloSiGuardado === undefined || leerRefresh()?.token === soloSiGuardado) borrarRefresh();
  version += 1;
}

export function getAccessToken() {
  return accessToken;
}

export function hayRefresh() {
  return Boolean(leerRefresh() ?? refreshEnMemoria);
}

/** Guarda los tokens de un login o de una invitación aceptada y avisa a las demás pestañas. */
export function iniciarSesionLocal(access: string, refresh: string, recordar: boolean) {
  aplicarTokens(access, refresh, recordar);
  publicar({ tipo: "tokens", access, refresh, recordar });
}

/** Avisa a las demás pestañas que el perfil cambió (nombre, foto). */
export function avisarPerfilCambiado() {
  publicar({ tipo: "perfil" });
}

/** Borra la sesión de esta pestaña y de las demás. */
export function cerrarSesionLocal() {
  borrarLocal();
  publicar({ tipo: "cierre" });
}

/**
 * Pide la sesión a las otras pestañas abiertas (sesión sin "Recordarme": el refresh
 * token está en el sessionStorage de cada pestaña). true si alguna respondió.
 */
export function pedirSesionAPestanas(): Promise<boolean> {
  if (!canal) return Promise.resolve(false);
  return new Promise((resolve) => {
    const tiempo = setTimeout(() => {
      esperandoRespuesta = null;
      resolve(false);
    }, TIEMPO_RESPUESTA_PESTANAS_MS);
    esperandoRespuesta = (m) => {
      clearTimeout(tiempo);
      esperandoRespuesta = null;
      aplicarTokens(m.access, m.refresh, m.recordar);
      resolve(true);
    };
    publicar({ tipo: "pedir" });
  });
}

const conCandado = <T>(fn: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks
    ? (navigator.locks.request(CANDADO, fn) as Promise<T>)
    : fn();

interface TokensRenovados {
  access_token: string;
  refresh_token: string;
}

/**
 * Renueva el access token con el refresh token. Devuelve el access token vigente.
 * Lanza ApiError 401 si la sesión ya no sirve (y la borra), o el error de red tal cual.
 */
export function renovarSesion(): Promise<string> {
  if (renovacionEnCurso) return renovacionEnCurso;
  const versionInicial = version;

  renovacionEnCurso = conCandado(async () => {
    // Mientras esperaba el candado, otra pestaña pudo renovar y mandar los tokens nuevos.
    if (version !== versionInicial && accessToken) return accessToken;

    // Pestaña recién cargada (o recargada): las abiertas tienen en memoria los tokens vigentes.
    // Con el candado nadie está renovando, así que se pueden usar sin rotarlos. Renovar con el
    // refresh token guardado fallaría si otra pestaña ya lo rotó: el de sessionStorage es de
    // esta pestaña, y el aviso de la rotación puede llegar después de obtener el candado.
    if (!accessToken && (await pedirSesionAPestanas()) && accessToken) return accessToken;

    // Primero el almacenamiento: con "Recordarme", localStorage tiene el último token aunque
    // el aviso de la pestaña que lo rotó todavía no haya llegado.
    let guardado = leerRefresh() ?? refreshEnMemoria;
    if (!guardado) {
      borrarLocal();
      emitir({ tipo: "cerrada", motivo: "expirada" });
      throw new ApiError(401, "Tu sesión expiró");
    }

    for (let intento = 1; ; intento += 1) {
      try {
        const { data } = await axios.post<Respuesta<TokensRenovados>>(`${API_URL}/auth/refresh-token`, {
          refresh_token: guardado.token,
        });
        const { access_token, refresh_token } = data.data;
        aplicarTokens(access_token, refresh_token, guardado.recordar);
        publicar({
          tipo: "tokens",
          access: access_token,
          refresh: refresh_token,
          recordar: guardado.recordar,
        });
        return access_token;
      } catch (error) {
        const apiError = toApiError(error);
        // Si el aviso de otra pestaña llegó mientras tanto, su token ya es el bueno.
        if (version !== versionInicial && accessToken) return accessToken;
        if (apiError.status !== 401 && apiError.status !== 403) throw apiError;

        // Otra pestaña rotó el token guardado mientras se usaba el anterior: una vez más con el nuevo.
        const actual = leerRefresh();
        if (intento === 1 && actual && actual.token !== guardado.token) {
          guardado = actual;
          continue;
        }
        // La sesión de esta pestaña terminó. El almacenamiento compartido se borra solo si
        // todavía tiene el token que falló: si otra pestaña dejó uno nuevo, sigue sirviendo.
        borrarLocal({ soloSiGuardado: guardado.token });
        emitir({ tipo: "cerrada", motivo: "expirada" });
        throw apiError;
      }
    }
  }).finally(() => {
    renovacionEnCurso = null;
  });

  return renovacionEnCurso;
}

/** Solo para pruebas: deja el módulo como recién cargado. */
export function __reiniciarSesionParaPruebas() {
  accessToken = null;
  refreshEnMemoria = null;
  version = 0;
  renovacionEnCurso = null;
  oyentes.clear();
  borrarRefresh();
}
