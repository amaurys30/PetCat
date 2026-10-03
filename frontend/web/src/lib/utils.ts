import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Sin esto, tailwind-merge confunde `text-body` (tamaño) con `text-ink` (color) y descarta uno.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["kpi", "title", "card", "body", "label"],
      radius: ["control", "card", "modal"],
      shadow: ["card", "modal"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
