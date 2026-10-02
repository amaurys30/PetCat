import { Outlet } from "react-router";
import { PlanLimitDialog } from "@/components/common/PlanLimitDialog";

/** Raíz de las rutas: lo global que necesita el router (diálogos que navegan). */
export function Raiz() {
  return (
    <>
      <Outlet />
      <PlanLimitDialog />
    </>
  );
}
