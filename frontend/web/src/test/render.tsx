import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { Me, NegocioMio } from "@/api/types";
import { crearQueryClient } from "@/app/queryClient";
import { rutas } from "@/app/router";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/auth";

/** Pinta la app en `ruta` con las rutas reales, con o sin sesión. */
export function renderRuta(ruta: string, { usuario, state }: { usuario?: Me; state?: unknown } = {}) {
  useAuth.setState({ estado: usuario ? "autenticado" : "anonimo", usuario: usuario ?? null, salida: null });
  const url = new URL(ruta, "http://localhost");
  const router = createMemoryRouter(rutas, {
    initialEntries: [{ pathname: url.pathname, search: url.search, state }],
  });
  const resultado = render(
    <QueryClientProvider client={crearQueryClient()}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster />
    </QueryClientProvider>,
  );
  return { ...resultado, router };
}

export const negocioDemo = (cambios: Partial<NegocioMio> = {}): NegocioMio => ({
  id_negocio: 1,
  nombre: "Clínica Veterinaria Patitas",
  tipo: "veterinaria",
  ciudad: "Sincelejo",
  logo_url: null,
  logo_miniatura_url: null,
  verificado: true,
  activo: true,
  relacion: "propietario",
  id_empleado: null,
  rol: null,
  plan: { id_plan: 1, nombre: "Gratuito", en_prueba: false },
  ...cambios,
});

export const usuarioDemo = (cambios: Partial<Me> = {}): Me => ({
  id_usuario: 2,
  nombre: "Laura",
  apellido: "Gómez",
  email: "propietario@petcat.test",
  telefono: null,
  foto_url: null,
  foto_miniatura_url: null,
  tipo_usuario: "negocio",
  email_verificado: true,
  telefono_verificado: false,
  idioma: "es",
  zona_horaria: "America/Bogota",
  notif_email: true,
  notif_push: true,
  notif_whatsapp: true,
  ultimo_acceso: null,
  fecha_registro: "2026-09-01 10:00:00",
  requiere_aceptar_politica: false,
  politica: { version: "1.0", url: null },
  negocios: [negocioDemo()],
  ...cambios,
});
