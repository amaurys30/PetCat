import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Bloque de carga. Sin `etiqueta` es decorativo (dentro de un CargandoGrupo); con ella se
 * anuncia solo: "Cargando historial", ocupado (aria-busy).
 */
export function Skeleton({ className, etiqueta, ...props }: ComponentProps<"div"> & { etiqueta?: string }) {
  const accesible = etiqueta
    ? ({ role: "status", "aria-busy": true, "aria-label": etiqueta } as const)
    : ({ "aria-hidden": true } as const);
  return <div {...accesible} className={cn("animate-pulse rounded-full bg-track", className)} {...props} />;
}

/** Contenedor de varios esqueletos: un solo estado de carga para los lectores de pantalla. */
export function CargandoGrupo({
  etiqueta = "Cargando",
  ...props
}: ComponentProps<"div"> & { etiqueta?: string }) {
  return <div role="status" aria-busy aria-label={etiqueta} {...props} />;
}
