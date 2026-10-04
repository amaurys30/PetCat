import { useEffect } from "react";
import { Link, Navigate, Outlet } from "react-router";
import { SECCIONES } from "@/app/menu";
import { NoEncontrado, SinPermiso } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useNegocioActivo, useNegocioDeRuta, usePuede } from "@/features/negocios/hooks/useNegocio";
import { useNegocioStore } from "@/stores/negocio";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * /n/:idNegocio/*: comprueba que el usuario pueda entrar a ese negocio (está en
 * `/auth/me`) y pinta el panel con Sidebar y Topbar.
 */
export function PanelLayout() {
  const negocio = useNegocioDeRuta();
  const setIdNegocio = useNegocioStore((s) => s.setIdNegocio);

  useEffect(() => {
    setIdNegocio(negocio?.id_negocio ?? null);
    return () => setIdNegocio(null);
  }, [negocio?.id_negocio, setIdNegocio]);

  if (!negocio) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <NoEncontrado
          descripcion="Este negocio no existe o no tienes acceso a él."
          acciones={
            <Button asChild variant="secondary">
              <Link to="/negocios">Ver mis negocios</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Al propietario con el negocio a medio configurar se le retoma el asistente (A6).
  if (negocio.relacion === "propietario" && negocio.configuracion_pendiente) {
    return <Navigate to={`/negocios/${negocio.id_negocio}/configurar`} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <AvisoConfiguracionPendiente />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const TEXTO_PENDIENTE = {
  sede: "Este negocio todavía no tiene sedes: no aparece en la app ni recibe reservas.",
  horarios: "Ninguna sede tiene horario de atención: el negocio no recibe reservas.",
};

/** A un empleado que puede editar la configuración, le avisa que el negocio está a medias. */
function AvisoConfiguracionPendiente() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const pendiente = negocio.configuracion_pendiente;
  if (!pendiente || !puede("configuracion", "editar")) return null;
  return (
    <Alert tono="advertencia" className="mb-5">
      {TEXTO_PENDIENTE[pendiente]}{" "}
      <Link to="configuracion/sedes" className="font-semibold underline">
        Ir a Sedes y horarios
      </Link>
    </Alert>
  );
}

/** /n/:idNegocio: a la primera sección que el rol permite. */
export function PrimeraSeccion() {
  const puede = usePuede();
  const seccion = SECCIONES.find((s) => puede(...s.permiso));
  if (!seccion) {
    return (
      <SinPermiso descripcion="Tu rol todavía no tiene acceso a ninguna sección. Pídele al propietario que lo actualice." />
    );
  }
  return <Navigate to={seccion.ruta} replace />;
}
