import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 rounded-full px-2 text-label font-semibold whitespace-nowrap",
  {
    variants: {
      tono: {
        primary: "bg-primary-soft text-primary-dark",
        info: "bg-info-soft text-info",
        warning: "bg-warning-soft text-warning-ink",
        danger: "bg-danger-soft text-danger",
        done: "bg-done-soft text-done",
        neutral: "bg-track text-muted",
        solid: "bg-warning text-white",
      },
    },
    defaultVariants: { tono: "neutral" },
  },
);

export function Badge({
  className,
  tono,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tono }), className)} {...props} />;
}
