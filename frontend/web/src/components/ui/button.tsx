import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-dark",
        secondary: "border bg-white text-ink hover:bg-surface",
        ghost: "text-ink hover:bg-track",
        link: "h-auto px-0 text-primary hover:text-primary-dark hover:underline",
        danger: "bg-danger text-white hover:bg-danger/90",
        "danger-outline": "border border-danger/30 bg-white text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 px-3 text-label",
        md: "h-9 px-4 text-body",
        lg: "h-10 px-5 text-card",
        icon: "size-9",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Muestra un indicador y deshabilita el botón mientras se envía. */
  cargando?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  cargando,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {cargando && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
