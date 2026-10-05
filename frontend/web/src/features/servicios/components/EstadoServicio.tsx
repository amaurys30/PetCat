import { useState } from "react";
import { useNavigate } from "react-router";
import { toApiError } from "@/api/errors";
import { citasDelConflicto, type Servicio } from "@/api/servicios";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { aviso } from "@/components/ui/toaster";
import { useUi } from "@/stores/ui";
import { useDesactivarServicio, useReactivarServicio } from "../hooks/useServicios";

/** Estado de navegación al editar un servicio inactivo cuyo nombre ya está en uso. */
export interface EstadoRenombrar {
  renombrar: true;
}

/**
 * Desactivar y reactivar un servicio, con sus diálogos. Desactivar con citas futuras da 409
 * con las citas: se muestran en el diálogo de citas (el mismo de horarios y disponibilidad).
 * Reactivar con el nombre ocupado da 409 con `errors.nombre`: se ofrece cambiar el nombre.
 * `rutaEdicion` lleva al formulario del servicio (relativa a la pantalla que lo usa).
 */
export function useEstadoServicio(rutaEdicion: (s: Servicio) => string) {
  const navigate = useNavigate();
  const [desactivando, setDesactivando] = useState<Servicio | null>(null);
  const [nombreOcupado, setNombreOcupado] = useState<Servicio | null>(null);
  const desactivar = useDesactivarServicio();
  const reactivar = useReactivarServicio();
  const mostrarCitasAfectadas = useUi((s) => s.mostrarCitasAfectadas);

  const confirmarDesactivar = (s: Servicio) =>
    desactivar.mutate(s.id_servicio, {
      onSuccess: () => {
        setDesactivando(null);
        aviso.exito(`«${s.nombre}» quedó inactivo. Ya no aparece en la app ni en la agenda.`);
      },
      onError: (e) => {
        const error = toApiError(e);
        const citas = citasDelConflicto(error.data);
        if (error.status !== 409 || citas.length === 0) return;
        setDesactivando(null);
        desactivar.reset();
        mostrarCitasAfectadas(citas, "", {
          titulo: `«${s.nombre}» no se puede desactivar: ${
            citas.length === 1
              ? "tiene 1 cita pendiente o confirmada"
              : `tiene ${citas.length} citas pendientes o confirmadas`
          }`,
          descripcion:
            "Cancela o reprograma estas citas y vuelve a intentarlo. Avísale a cada cliente; puedes copiar la lista para llamarlos.",
        });
      },
    });

  const pedirReactivar = (s: Servicio) =>
    reactivar.mutate(s.id_servicio, {
      onSuccess: () => aviso.exito(`«${s.nombre}» está activo de nuevo`),
      onError: (e) => {
        const error = toApiError(e);
        if (error.status === 409 && error.errors.nombre) setNombreOcupado(s);
        else aviso.advertencia(error.message);
      },
    });

  const dialogos = (
    <>
      <ConfirmDialog
        abierto={desactivando !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) {
            setDesactivando(null);
            desactivar.reset();
          }
        }}
        titulo={`¿Desactivar «${desactivando?.nombre ?? ""}»?`}
        descripcion="Deja de aparecer en la app y ya no se podrá agendar. Si tiene citas pendientes o confirmadas, te mostraremos cuáles para resolverlas antes. Podrás reactivarlo después con sus profesionales."
        confirmar="Desactivar"
        peligro
        cargando={desactivar.isPending}
        onConfirmar={() => desactivando && confirmarDesactivar(desactivando)}
      >
        {desactivar.error && <Alert tono="error">{desactivar.error.message}</Alert>}
      </ConfirmDialog>
      <ConfirmDialog
        abierto={nombreOcupado !== null}
        onAbiertoChange={(abierto) => !abierto && setNombreOcupado(null)}
        titulo={`Ya hay otro servicio activo llamado «${nombreOcupado?.nombre ?? ""}»`}
        descripcion="Dos servicios activos no pueden tener el mismo nombre. Cámbiale el nombre a este y después reactívalo."
        confirmar="Cambiar nombre"
        onConfirmar={() => {
          if (!nombreOcupado) return;
          navigate(rutaEdicion(nombreOcupado), { state: { renombrar: true } satisfies EstadoRenombrar });
          setNombreOcupado(null);
        }}
      />
    </>
  );

  return {
    desactivar: setDesactivando,
    reactivar: pedirReactivar,
    reactivando: reactivar.isPending,
    dialogos,
  };
}
