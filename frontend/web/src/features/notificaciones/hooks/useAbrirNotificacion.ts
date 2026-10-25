import { useNavigate } from "react-router";
import type { Notificacion } from "@/api/notificaciones";
import { aviso } from "@/components/ui/toaster";
import { useAuth } from "@/stores/auth";
import { destinoDe } from "../destino";
import { useMarcarLeida } from "./useNotificaciones";

/** Abrir una notificación: la marca como leída y lleva a su pantalla (cambia de negocio si hace falta). */
export function useAbrirNotificacion() {
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const marcar = useMarcarLeida();
  return (n: Notificacion) => {
    if (!n.leida) marcar.mutate(n);
    const destino = destinoDe(n, usuario?.negocios.map((x) => x.id_negocio) ?? []);
    if (destino.tipo === "ruta") void navigate(destino.ruta);
    else if (destino.tipo === "sin_acceso")
      aviso.info("Ya no tienes acceso al negocio de esta notificación.");
  };
}
