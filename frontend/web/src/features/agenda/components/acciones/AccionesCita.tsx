import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import type { Cita, CitaPanelDetalle } from "@/api/citas";
import { aviso } from "@/components/ui/toaster";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { fechaHoraCita } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { accionesDe } from "../../acciones";
import { useCita } from "../../hooks/useCita";
import { nombreProfesional } from "../../textos";
import { CancelarCitaDialog } from "./CancelarCitaDialog";
import { CompletarDialog } from "./CompletarDialog";
import { ReasignarDialog } from "./ReasignarDialog";
import { ReprogramarDialog } from "./ReprogramarDialog";

/**
 * Diálogos de las acciones sobre una cita (B6, B7, B8 y reasignar). Se abren con
 * `useUi().abrirAccionCita(tipo, idCita)` desde el detalle, el panel lateral de la agenda,
 * el diálogo de citas afectadas o la disponibilidad del profesional. Vive en PanelLayout.
 * Al resolver una cita afectada, sale de esa lista.
 */
export function AccionesCita() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const accion = useUi((s) => s.accionCita);
  const cerrar = useUi((s) => s.cerrarAccionCita);
  const quitarCitaAfectada = useUi((s) => s.quitarCitaAfectada);
  const abrirRegistroMedico = useUi((s) => s.abrirRegistroMedico);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const cita = useCita(negocio.id_negocio, accion?.idCita);

  useEffect(() => {
    if (accion && cita.isError) {
      aviso.error(cita.error.message);
      cerrar();
    }
  }, [accion, cita.isError, cita.error, cerrar]);

  if (!accion || !cita.data || cita.data.id_cita !== accion.idCita) return null;

  const resuelta = (mensaje: string) => {
    quitarCitaAfectada(accion.idCita);
    aviso.exito(mensaje);
    cerrar();
  };
  // En la agenda, la cita nueva queda abierta en su fecha.
  const reprogramada = (nueva: Cita) => {
    resuelta(`Cita reprogramada: ${fechaHoraCita(nueva.fecha, nueva.hora_inicio)}`);
    if (pathname.endsWith("/agenda")) {
      const params = new URLSearchParams(search);
      params.set("cita", String(nueva.id_cita));
      if (nueva.fecha === hoyISO()) params.delete("fecha");
      else params.set("fecha", nueva.fecha);
      navigate({ search: `?${params}` });
    }
  };
  const props = { idNegocio: negocio.id_negocio, cita: cita.data, onCerrar: cerrar };

  switch (accion.tipo) {
    case "cancelar":
    case "rechazar":
      return (
        <CancelarCitaDialog
          {...props}
          rechazar={accion.tipo === "rechazar"}
          onListo={() => resuelta(accion.tipo === "rechazar" ? "Cita rechazada" : "Cita cancelada")}
        />
      );
    case "reasignar":
      return (
        <ReasignarDialog
          {...props}
          onListo={(c: CitaPanelDetalle) => resuelta(`Cita reasignada a ${nombreProfesional(c)}`)}
        />
      );
    case "reprogramar":
      return <ReprogramarDialog cita={cita.data} onCerrar={cerrar} onListo={reprogramada} />;
    case "completar":
      return (
        <CompletarDialog
          {...props}
          acciones={accionesDe(cita.data, {
            editar: puede("citas", "editar"),
            cancelar: puede("citas", "cancelar"),
          })}
          ofrecerRegistro={puede("historial_medico", "crear")}
          onListo={(c, mensaje, crearRegistro) => {
            resuelta(mensaje);
            // C4 con la cita, su fecha y su profesional (lo pinta RegistroMedicoHost).
            if (crearRegistro)
              abrirRegistroMedico({
                idMascota: c.mascota.id_mascota,
                idCita: c.id_cita,
                fecha: c.fecha,
                idEmpleado: c.empleado?.id_empleado ?? null,
              });
          }}
        />
      );
  }
}
