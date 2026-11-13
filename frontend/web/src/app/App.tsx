import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/auth";
import { queryClient } from "./queryClient";
import { router } from "./router";

/**
 * Al cargar: si hay sesión guardada, se renueva. Las páginas públicas se pintan de una vez; el
 * panel espera la renovación (layouts/Raiz.tsx).
 */
export function App() {
  const iniciar = useAuth((s) => s.iniciar);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
