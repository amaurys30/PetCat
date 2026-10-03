import {
  CalendarDays,
  ChartColumn,
  Lock,
  OctagonX,
  SearchX,
  TimerOff,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Estados del sistema (Figma S1). Se muestran dentro del área de contenido del panel
 * o en una tarjeta. `EstadoPantalla` es la base; los demás son los casos del diseño.
 */
export function EstadoPantalla({
  icono: Icono,
  titulo,
  descripcion,
  acciones,
  tono = "neutral",
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  tono?: "neutral" | "primary" | "danger" | "warning";
  className?: string;
}) {
  const colores = {
    neutral: "bg-track text-muted",
    primary: "bg-primary-soft text-primary-dark",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning-ink",
  }[tono];
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <span className={cn("mb-3 flex size-11 items-center justify-center rounded-full", colores)}>
        <Icono className="size-5" aria-hidden />
      </span>
      <h2 className="text-card font-semibold text-ink">{titulo}</h2>
      {descripcion && <p className="mt-1.5 max-w-md text-body text-muted">{descripcion}</p>}
      {acciones && <div className="mt-4 flex flex-wrap justify-center gap-2">{acciones}</div>}
    </div>
  );
}

type Preset = { acciones?: ReactNode; descripcion?: ReactNode; className?: string };

export const SinPermiso = ({ acciones, descripcion, className }: Preset) => (
  <EstadoPantalla
    icono={Lock}
    titulo="No tienes permiso para ver esta sección"
    descripcion={descripcion ?? "Tu rol no incluye este módulo. Pídele al propietario que actualice tu rol."}
    acciones={acciones}
    className={className}
  />
);

export const NoEncontrado = ({ acciones, descripcion, className }: Preset) => (
  <EstadoPantalla
    icono={SearchX}
    titulo="No encontramos lo que buscas"
    descripcion={descripcion ?? "La página o el registro no existe o ya no está disponible."}
    acciones={acciones}
    className={className}
  />
);

export const Vacio = ({
  titulo,
  icono = CalendarDays,
  acciones,
  descripcion,
  className,
}: Preset & { titulo: string; icono?: LucideIcon }) => (
  <EstadoPantalla
    icono={icono}
    tono="primary"
    titulo={titulo}
    descripcion={descripcion}
    acciones={acciones}
    className={className}
  />
);

export const SinConexion = ({ acciones, descripcion, className }: Preset) => (
  <EstadoPantalla
    icono={WifiOff}
    titulo="Sin conexión con el servidor"
    descripcion={descripcion ?? "Revisa tu internet. Reintentaremos automáticamente."}
    acciones={acciones}
    className={className}
  />
);

export const SesionExpirada = ({ acciones, className }: Preset) => (
  <EstadoPantalla
    icono={TimerOff}
    titulo="Tu sesión expiró"
    descripcion="Por seguridad cerramos tu sesión. Vuelve a ingresar para continuar."
    acciones={acciones}
    className={className}
  />
);

export const LimitePlan = ({ acciones, descripcion, className }: Preset) => (
  <EstadoPantalla
    icono={ChartColumn}
    tono="warning"
    titulo="Alcanzaste el límite de tu plan"
    descripcion={descripcion}
    acciones={acciones}
    className={className}
  />
);

export const CuentaBloqueada = ({ acciones, descripcion, className }: Preset) => (
  <EstadoPantalla
    icono={OctagonX}
    tono="danger"
    titulo="Cuenta bloqueada temporalmente"
    descripcion={
      descripcion ??
      "Hubo 5 intentos fallidos. Podrás intentarlo de nuevo en 15 minutos o restablecer tu contraseña."
    }
    acciones={acciones}
    className={className}
  />
);

/** Esqueleto de carga genérico: líneas grises mientras llegan los datos. */
export function Cargando({ lineas = 3, className }: { lineas?: number; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={cn("flex flex-col gap-3 p-6", className)}>
      {Array.from({ length: lineas }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${[90, 70, 80, 60][i % 4]}%` }} />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
