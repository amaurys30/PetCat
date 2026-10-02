import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

/** Tooltip simple: `<Tooltip texto="...">{boton}</Tooltip>`. */
export function Tooltip({
  texto,
  children,
  lado = "top",
}: {
  texto: ReactNode;
  children: ReactNode;
  lado?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={lado}
          sideOffset={6}
          className="z-50 max-w-64 animate-fade-in rounded-[6px] bg-ink px-2.5 py-1.5 text-label text-white"
        >
          {texto}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
