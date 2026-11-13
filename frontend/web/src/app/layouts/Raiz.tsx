import { useEffect } from "react";
import { Outlet } from "react-router";
import { CitasAfectadasDialog } from "@/components/common/CitasAfectadasDialog";
import { SinConexion } from "@/components/common/EstadoPantalla";
import { Logo } from "@/components/common/Logo";
import { PlanLimitDialog } from "@/components/common/PlanLimitDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth";

/**
 * Raíz de las rutas del panel: espera a que se renueve la sesión guardada (las páginas públicas
 * no esperan) y pinta lo global que necesita el router (diálogos que navegan).
 */
export function Raiz() {
  const estado = useAuth((s) => s.estado);
  const iniciar = useAuth((s) => s.iniciar);

  // index.html trae el título de la landing; el panel tiene el suyo.
  useEffect(() => {
    document.title = "PetCat · Panel";
  }, []);

  if (estado === "iniciando") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Cargando PetCat"
      >
        <Logo className="animate-pulse" />
      </div>
    );
  }
  if (estado === "sin-conexion") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SinConexion acciones={<Button onClick={() => void iniciar()}>Reintentar</Button>} />
      </div>
    );
  }
  return (
    <>
      <Outlet />
      <PlanLimitDialog />
      <CitasAfectadasDialog />
    </>
  );
}
