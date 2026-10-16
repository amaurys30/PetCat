import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

const MILES = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/**
 * Pesos colombianos sin decimales: guarda solo los dígitos ("45000") y muestra los miles
 * con punto ("45.000"). Vacío = sin dato.
 */
export function CampoDinero({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value === "" ? "" : MILES.format(Number(value))}
      onChange={(e) =>
        onChange(
          e.target.value
            .replace(/\D/g, "")
            .replace(/^0+(?=\d)/, "")
            .slice(0, 10),
        )
      }
      {...props}
    />
  );
}
