import { AlertTriangle, Check, X } from "lucide-react";
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
};
