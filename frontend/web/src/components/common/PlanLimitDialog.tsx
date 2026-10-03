import { ChartColumn } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNegocioStore } from "@/stores/negocio";
import { useUi } from "@/stores/ui";

/**
 * Botones de la invitación a Pro. Llevan a Suscripción (E4), donde se activa la
 * prueba o se ven los planes.
 */
export function PlanLimitAcciones({ alElegir }: { alElegir?: () => void }) {
  const idNegocio = useNegocioStore((s) => s.idNegocio);
  if (!idNegocio) return null;
  const destino = `/n/${idNegocio}/suscripcion`;
  return (
    <>
      <Button asChild onClick={alElegir}>
        <Link to={destino}>Probar Pro 14 días</Link>
      </Button>
      <Button asChild variant="secondary" onClick={alElegir}>
        <Link to={destino}>Ver planes</Link>
      </Button>
    </>
  );
}

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
