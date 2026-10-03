import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  Package,
  Settings,
  Star,
  Stethoscope,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Modulo } from "@/api/types";

/** Secciones del panel: menú lateral, rutas /n/:idNegocio/<ruta> y permiso para verlas. */
export interface Seccion {
  ruta: string;
  titulo: string;
  icono: LucideIcon;
  permiso: [Modulo, string];
  /** Fase del plan del panel en que se construye (mientras tanto, la ruta muestra un aviso). */
  fase: string;
}

export const GRUPOS_MENU: { titulo: string; secciones: Seccion[] }[] = [
  {
    titulo: "Principal",
    secciones: [
      {
        ruta: "dashboard",
        titulo: "Dashboard",
        icono: ChartColumn,
        permiso: ["reportes", "ver"],
        fase: "P6",
      },
      { ruta: "agenda", titulo: "Agenda", icono: CalendarDays, permiso: ["citas", "ver"], fase: "P4" },
      { ruta: "clientes", titulo: "Clientes", icono: Users, permiso: ["clientes", "ver"], fase: "P5" },
      { ruta: "servicios", titulo: "Servicios", icono: Wrench, permiso: ["servicios", "ver"], fase: "P3" },
    ],
  },
  {
    titulo: "Equipo y clientes",
    secciones: [
      { ruta: "equipo", titulo: "Equipo", icono: Stethoscope, permiso: ["empleados", "ver"], fase: "P2" },
      { ruta: "resenas", titulo: "Reseñas", icono: Star, permiso: ["resenas", "ver"], fase: "P6" },
    ],
  },
  {
    titulo: "Negocio",
    secciones: [
      {
        ruta: "configuracion",
        titulo: "Configuración",
        icono: Settings,
        permiso: ["configuracion", "ver"],
        fase: "P1",
      },
      {
        ruta: "suscripcion",
        titulo: "Suscripción",
        icono: CreditCard,
        permiso: ["configuracion", "ver"],
        fase: "P6",
      },
    ],
  },
];

export const SECCIONES = GRUPOS_MENU.flatMap((g) => g.secciones);

/** Módulos que la API todavía no tiene (se muestran deshabilitados). */
export const PROXIMAMENTE = [{ titulo: "Inventario", icono: Package as LucideIcon, etiqueta: "Fase 3" }];
