import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { NoLeidas, Notificacion } from "@/api/notificaciones";
import { queryKeys } from "@/lib/queryKeys";
import { conectarSocket } from "@/lib/socket";
import { useAuth } from "@/stores/auth";
import { mostrarAvisoSistema } from "../avisosNavegador";
import { AVISO_NAVEGADOR, destinoDe, esReservaPorConfirmar, textoContador } from "../destino";
import { useMarcarLeida, useNoLeidas } from "../hooks/useNotificaciones";

const TITULO = "PetCat · Panel";

/**
 * Notificaciones en tiempo real (montado en PanelLayout, no pinta nada).
 * - `notificacion` del panel: sube el contador y recarga las listas; si es una reserva nueva por
 *   confirmar y la pestaña no está a la vista, el aviso del sistema operativo (si se activó).
 * - `notificaciones_leidas` (otra sesión marcó): toma el contador del panel.
 * - Al reconectar se vuelve a pedir el contador: se pudieron perder eventos.
 * También pone las no leídas en el título de la pestaña: "(3) PetCat · Panel".
 */
export function TiempoRealNotificaciones() {
  const idUsuario = useAuth((s) => s.usuario?.id_usuario);
  const usuario = useAuth((s) => s.usuario);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const marcar = useMarcarLeida();
  const noLeidas = useNoLeidas().data?.total ?? 0;

  useEffect(() => {
    document.title = noLeidas > 0 ? `(${textoContador(noLeidas)}) ${TITULO}` : TITULO;
  }, [noLeidas]);
  useEffect(() => () => void (document.title = TITULO), []);

  // Lo que cambia sin reconectar.
  const actual = useRef({ navigate, marcar: marcar.mutate, negocios: [] as number[] });
  useEffect(() => {
    actual.current = {
      navigate,
      marcar: marcar.mutate,
      negocios: usuario?.negocios.map((n) => n.id_negocio) ?? [],
    };
  }, [navigate, marcar.mutate, usuario]);

  useEffect(() => {
    if (!idUsuario) return;
    const socket = conectarSocket(idUsuario);
    const recargar = () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.todas() });

    const alLlegar = (n: Notificacion) => {
      if (n.destino !== "negocio") return;
      queryClient.setQueryData<NoLeidas>(queryKeys.notificaciones.noLeidas(), (previo) =>
        previo ? { ...previo, total: previo.total + 1 } : previo,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.listas() });
      if (!esReservaPorConfirmar(n)) return;
      mostrarAvisoSistema({
        titulo: AVISO_NAVEGADOR.titulo,
        cuerpo: AVISO_NAVEGADOR.cuerpo,
        tag: `cita-${n.datos.id_cita ?? n.id_notificacion}`,
        alHacerClic: () => {
          const { navigate: ir, marcar: marcarLeida, negocios } = actual.current;
          marcarLeida(n);
          const destino = destinoDe(n, negocios);
          if (destino.tipo === "ruta") void ir(destino.ruta);
        },
      });
    };
    const alLeer = ({ por_destino }: { por_destino?: { negocio: number } }) => {
      if (por_destino) {
        queryClient.setQueryData<NoLeidas>(queryKeys.notificaciones.noLeidas(), (previo) =>
          previo ? { ...previo, total: por_destino.negocio } : previo,
        );
      }
      void recargar();
    };
    let conectado = socket.connected;
    const alConectar = () => {
      if (conectado) void recargar();
      conectado = true;
    };

    socket.on("notificacion", alLlegar);
    socket.on("notificaciones_leidas", alLeer);
    socket.on("connect", alConectar);
    return () => {
      socket.off("notificacion", alLlegar);
      socket.off("notificaciones_leidas", alLeer);
      socket.off("connect", alConectar);
    };
  }, [idUsuario, queryClient]);

  return null;
}
