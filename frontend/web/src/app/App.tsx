import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { Logo } from "@/components/common/Logo";
import { SinConexion } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/auth";
import { queryClient } from "./queryClient";
import { router } from "./router";

/** Al cargar: si hay sesión guardada, se renueva antes de pintar el panel. */
export function App() {
  const estado = useAuth((s) => s.estado);
  const iniciar = useAuth((s) => s.iniciar);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {estado === "iniciando" && (
          <div
            className="flex min-h-screen items-center justify-center"
            role="status"
            aria-label="Cargando PetCat"
          >
            <Logo className="animate-pulse" />
          </div>
        )}
        {estado === "sin-conexion" && (
          <div className="flex min-h-screen items-center justify-center">
            <SinConexion acciones={<Button onClick={() => void iniciar()}>Reintentar</Button>} />
          </div>
        )}
        {(estado === "anonimo" || estado === "autenticado") && <RouterProvider router={router} />}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
