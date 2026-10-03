import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Mensaje en línea dentro de un formulario o tarjeta (no flotante). */
const alertVariants = cva("rounded-control px-3 py-2.5 text-body", {
  variants: {
    tono: {
      error: "bg-danger-soft text-danger",
      exito: "bg-primary-soft text-primary-dark",
      info: "bg-info-soft text-info",
      advertencia: "bg-warning-soft text-warning-ink",
    },
  },
  defaultVariants: { tono: "info" },
});

export function Alert({
  className,
  tono,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={cn(alertVariants({ tono }), className)}
      {...props}
    />
  );
}
