import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * "Reducir movimiento" (en Android, "Quitar animaciones"): null mientras el sistema no responde,
 * después true o false. Para lo que no debe montarse ni un instante con la opción activada
 * (por ejemplo, un sensor): esperar a que deje de ser null.
 */
export function useReducirMovimientoConocido(): boolean | null {
  const [reducir, setReducir] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => vigente && setReducir(valor))
      .catch(() => vigente && setReducir(false));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducir);
    return () => {
      vigente = false;
      sub.remove();
    };
  }, []);

  return reducir;
}

/** true si el usuario activó "Reducir movimiento": nada de animaciones decorativas. */
export function useReducirMovimiento(): boolean {
  return useReducirMovimientoConocido() ?? false;
}
