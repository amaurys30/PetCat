import type { Ubicacion } from "@/lib/ubicacion";

export type ErroresUbicacion = Partial<Record<keyof Ubicacion, string>>;

export interface PropsUbicacion {
  value: Ubicacion;
  onChange: (ubicacion: Ubicacion) => void;
  errores?: ErroresUbicacion;
  disabled?: boolean;
}

export const AYUDA_UBICACION = 'Con la ubicación, tu negocio aparece en "Cerca de mí" en la app.';
