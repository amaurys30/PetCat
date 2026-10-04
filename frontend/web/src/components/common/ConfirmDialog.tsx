import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

/** Confirmación de una acción (desactivar, quitar, salir sin guardar). */
export function ConfirmDialog({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  confirmar,
  cancelar = "Cancelar",
  peligro = false,
  cargando = false,
  onConfirmar,
  children,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: ReactNode;
  confirmar: string;
  cancelar?: string;
  peligro?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  /** Contenido extra, como el error de la API. */
  children?: ReactNode;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle>{titulo}</DialogTitle>
        {descripcion && <DialogDescription className="mt-2">{descripcion}</DialogDescription>}
        {children && <div className="mt-4">{children}</div>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onAbiertoChange(false)} disabled={cargando}>
            {cancelar}
          </Button>
          <Button variant={peligro ? "danger" : "primary"} onClick={onConfirmar} cargando={cargando}>
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
