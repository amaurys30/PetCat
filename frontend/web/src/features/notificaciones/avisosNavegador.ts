import { useSyncExternalStore } from "react";

/**
 * Avisos del sistema operativo (Notification API) en este navegador. El panel web no recibe
 * push: con la pestaña oculta, una reserva nueva por confirmar se avisa así, si el usuario lo
 * activó y el navegador lo permite. La preferencia es de este navegador (localStorage); el
 * permiso lo guarda el navegador.
 */
export type EstadoAvisos = "no_soportado" | "bloqueado" | "activos" | "inactivos";

const CLAVE = "petcat.avisosNavegador";
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

const soportado = () => typeof window !== "undefined" && "Notification" in window;

function preferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function guardar(activos: boolean) {
  try {
    if (activos) localStorage.setItem(CLAVE, "1");
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (ventana privada): la preferencia dura lo que la pestaña.
  }
  avisar();
}

export function estadoAvisos(): EstadoAvisos {
  if (!soportado()) return "no_soportado";
  if (Notification.permission === "denied") return "bloqueado";
  return Notification.permission === "granted" && preferencia() ? "activos" : "inactivos";
}

/** Pide el permiso (solo si el usuario lo eligió) y guarda la preferencia. */
export async function activarAvisos(): Promise<EstadoAvisos> {
  if (!soportado()) return "no_soportado";
  const permiso =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  guardar(permiso === "granted");
  return estadoAvisos();
}

export function desactivarAvisos() {
  guardar(false);
}

export function useEstadoAvisos(): EstadoAvisos {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      // Otra pestaña cambió la preferencia.
      window.addEventListener("storage", oyente);
      return () => {
        oyentes.delete(oyente);
        window.removeEventListener("storage", oyente);
      };
    },
    estadoAvisos,
    () => "no_soportado",
  );
}

/**
 * Muestra el aviso si están activos y la pestaña no está visible. `tag` evita duplicados:
 * con varias pestañas abiertas, el navegador reemplaza el aviso del mismo `tag`.
 */
export function mostrarAvisoSistema({
  titulo,
  cuerpo,
  tag,
  alHacerClic,
}: {
  titulo: string;
  cuerpo: string;
  tag: string;
  alHacerClic: () => void;
}): boolean {
  if (estadoAvisos() !== "activos" || document.visibilityState === "visible") return false;
  const aviso = new Notification(titulo, { body: cuerpo, tag, icon: "/favicon.svg" });
  aviso.onclick = () => {
    window.focus();
    alHacerClic();
    aviso.close();
  };
  return true;
}
