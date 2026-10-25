import { ChartColumn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BotonesPlan } from "@/features/suscripcion/components/PruebaPro";
import { useUi } from "@/stores/ui";

/** Botones de la invitación a Pro: activar la prueba aquí mismo o ir a Suscripción (E4). */
export const PlanLimitAcciones = BotonesPlan;

/** Se abre solo con cualquier 403 que traiga `errors.plan` (ver app/queryClient.ts). */
export function PlanLimitDialog() {
  const mensaje = useUi((s) => s.limitePlan);
  const cerrar = useUi((s) => s.cerrarLimitePlan);
  return (
    <Dialog open={mensaje !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="max-w-[440px] text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
          <ChartColumn className="size-6" aria-hidden />
        </span>
        <DialogTitle>Alcanzaste el límite de tu plan</DialogTitle>
        <DialogDescription className="mt-2">{mensaje}</DialogDescription>
        <div className="mt-6 flex justify-center gap-2">
          <PlanLimitAcciones alElegir={cerrar} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
