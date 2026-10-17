import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { EVENTO_AGENDA, type CambioAgenda } from "@/api/citas";
import { aviso } from "@/components/ui/toaster";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { fechaHoraCita } from "@/lib/agenda";
import { queryKeys } from "@/lib/queryKeys";
import { conectarSocket } from "@/lib/socket";
import { useAuth } from "@/stores/auth";

interface NotificacionSocket {
  tipo: string;
  datos?: { id_negocio?: number } | null;
}

/**
 * Agenda en tiempo real (montado en PanelLayout, no pinta nada). Con `agenda_actualizada`
 * (y las notificaciones `cita_*`) recarga las citas del negocio y, si cambió la
 * disponibilidad, también la de los profesionales. Al reconectar recarga lo que se pudo
 * perder. Una reserva nueva desde la app se avisa a quien puede confirmarla (citas.editar),
 * con "Ver" para abrir su detalle, salvo que la haya hecho el propio usuario.
 */
export function TiempoRealAgenda() {
  const idUsuario = useAuth((s) => s.usuario?.id_usuario);
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Lo que cambia sin reconectar: el negocio abierto y si se avisan las reservas.
  const actual = useRef({ idNegocio: negocio.id_negocio, avisarReservas: false, navigate });
  useEffect(() => {
    actual.current = { idNegocio: negocio.id_negocio, avisarReservas: puede("citas", "editar"), navigate };
  }, [negocio.id_negocio, puede, navigate]);

  useEffect(() => {
    if (!idUsuario) return;
    const socket = conectarSocket(idUsuario);
    // Los clientes y la ficha de la mascota también: traen citas, conteos y la próxima cita.
    const recargar = (idNegocio: number) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.citas.todas(idNegocio) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientes.todos(idNegocio) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.salud.todo(idNegocio) });
    };

    const alCambiar = (cambio: CambioAgenda) => {
      recargar(cambio.id_negocio);
      if (cambio.accion === "disponibilidad") {
        void queryClient.invalidateQueries({ queryKey: ["disponibilidad"] });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.empleados.profesionales(cambio.id_negocio),
        });
      }
      const { idNegocio, avisarReservas, navigate: ir } = actual.current;
      const { cita, id_cita } = cambio;
      if (
        cambio.accion === "reserva_app" &&
        cita &&
        id_cita &&
        cambio.id_negocio === idNegocio &&
        avisarReservas &&
        cambio.por !== idUsuario
      ) {
        aviso.conAccion("Nueva reserva desde la app", {
          descripcion: `${cita.mascota} · ${cita.servicio} · ${fechaHoraCita(cita.fecha, cita.hora_inicio)}`,
          etiqueta: "Ver",
          icono: <CalendarPlus className="size-4 text-primary" />,
          onClick: () => void ir(`/n/${idNegocio}/agenda?fecha=${cita.fecha}&cita=${id_cita}`),
        });
      }
    };
    const alNotificar = (n: NotificacionSocket) => {
      if (n.tipo.startsWith("cita_") && n.datos?.id_negocio) recargar(n.datos.id_negocio);
    };
    // La primera conexión no recarga nada; una reconexión sí (pudo perder eventos).
    let conectado = socket.connected;
    const alConectar = () => {
      if (conectado) recargar(actual.current.idNegocio);
      conectado = true;
    };

    socket.on(EVENTO_AGENDA, alCambiar);
    socket.on("notificacion", alNotificar);
    socket.on("connect", alConectar);
    return () => {
      socket.off(EVENTO_AGENDA, alCambiar);
      socket.off("notificacion", alNotificar);
      socket.off("connect", alConectar);
    };
  }, [idUsuario, queryClient]);

  return null;
}
