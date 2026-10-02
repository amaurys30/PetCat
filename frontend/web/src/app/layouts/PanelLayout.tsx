import { useEffect } from "react";
import { Link, Navigate, Outlet } from "react-router";
import { SECCIONES } from "@/app/menu";
import { NoEncontrado, SinPermiso } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { useNegocioDeRuta, usePuede } from "@/features/negocios/hooks/useNegocio";
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
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
