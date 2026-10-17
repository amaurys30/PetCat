import { AlertTriangle, Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { toast, Toaster as Sonner } from "sonner";

/** Avisos flotantes (S1): éxito oscuro, error rojo suave, advertencia ámbar. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[360px] items-center gap-2.5 rounded-control px-3.5 py-3 text-body font-medium shadow-modal",
          success: "bg-ink text-white",
          error: "bg-danger-soft text-danger",
          warning: "bg-warning-soft text-warning-ink",
          info: "bg-info-soft text-info",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          description: "text-body font-normal opacity-80",
          actionButton:
            "shrink-0 cursor-pointer rounded-control bg-white/15 px-2.5 py-1 text-body font-semibold hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white",
        },
      }}
      icons={{
        success: <Check className="size-4 text-primary" />,
        error: <X className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
      }}
    />
  );
}

export const aviso = {
  exito: (mensaje: string) => toast.success(mensaje),
  error: (mensaje: string) => toast.error(mensaje),
  advertencia: (mensaje: string) => toast.warning(mensaje),
  info: (mensaje: string) => toast.info(mensaje),
  /** Aviso oscuro con una línea de detalle y un botón (p. ej. "Ver" en una reserva nueva). */
  conAccion: (
    mensaje: string,
    { descripcion, etiqueta, onClick, icono }: { descripcion?: string; etiqueta: string; onClick: () => void; icono?: ReactNode },
  ) =>
    toast(mensaje, {
      description: descripcion,
      icon: icono,
      className: "bg-ink text-white",
      duration: 10_000,
      action: { label: etiqueta, onClick },
    }),
};
