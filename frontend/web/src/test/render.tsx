import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { NegocioGestion, SucursalGestion } from "@/api/negocios";
import type { Me, NegocioMio } from "@/api/types";
import { crearQueryClient } from "@/app/queryClient";
import { crearRutas } from "@/app/router";
import { rutasPanel } from "@/app/rutasPanel";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/auth";

/** Pinta la app en `ruta` con las rutas reales, con o sin sesión. */
export function renderRuta(ruta: string, { usuario, state }: { usuario?: Me; state?: unknown } = {}) {
  useAuth.setState({ estado: usuario ? "autenticado" : "anonimo", usuario: usuario ?? null, salida: null });
  const url = new URL(ruta, "http://localhost");
  const router = createMemoryRouter(crearRutas(rutasPanel), {
    initialEntries: [{ pathname: url.pathname, search: url.search, hash: url.hash, state }],
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
  configuracion_pendiente: null,
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
  politica_aceptada: { version: "1.0", fecha: "2026-09-01 10:00:00", canal: "panel_web" },
  negocios: [negocioDemo()],
  ...cambios,
});

export const sedeDemo = (cambios: Partial<SucursalGestion> = {}): SucursalGestion => ({
  id_sucursal: 3,
  id_negocio: 1,
  nombre: "Sede Centro",
  descripcion: null,
  telefono: "3001234567",
  direccion: "Cra 19 #22-35, Centro",
  ciudad: "Sincelejo",
  latitud: 9.30472,
  longitud: -75.39778,
  es_principal: true,
  horarios: [
    { dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" },
    { dia_semana: 1, hora_apertura: "14:00", hora_cierre: "18:00" },
  ],
  ...cambios,
});

/** `GET /negocios/:id/gestion` de Patitas. */
export const gestionDemo = (cambios: Partial<NegocioGestion> = {}): NegocioGestion => ({
  id_negocio: 1,
  id_usuario_propietario: 2,
  nombre: "Clínica Veterinaria Patitas",
  tipo: "veterinaria",
  descripcion: "Atención veterinaria integral en Sincelejo.",
  telefono: "3001234567",
  whatsapp: null,
  email: "contacto@patitas.co",
  sitio_web: null,
  nit: "900123456-7",
  razon_social: "Patitas S.A.S.",
  direccion: "Cra 19 #22-35, Centro",
  ciudad: "Sincelejo",
  departamento: "Sucre",
  pais: "Colombia",
  codigo_postal: null,
  latitud: 9.30472,
  longitud: -75.39778,
  confirmacion_automatica: false,
  logo_url: null,
  logo_miniatura_url: null,
  banner_url: null,
  calificacion_promedio: 4.7,
  total_resenas: 38,
  total_citas: 120,
  verificado: true,
  destacado: false,
  activo: true,
  fecha_registro: "2026-09-01 10:00:00",
  fecha_actualizacion: "2026-09-01 10:00:00",
  sucursales: [sedeDemo()],
  reglas_confirmacion: {
    confirmacion_automatica: false,
    plazo_confirmacion_h: 24,
    confirmacion_antes_inicio_min: 60,
    citas_perdidas: { dias: 30, total: 0, sugerencia: null },
  },
  ...cambios,
});
