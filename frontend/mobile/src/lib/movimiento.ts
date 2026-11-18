import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** true si el usuario activó "Reducir movimiento": nada de animaciones decorativas. */
export function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(false);

  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => vigente && setReducir(valor))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducir);
    return () => {
      vigente = false;
      sub.remove();
    };
  }, []);

  return reducir;
}
