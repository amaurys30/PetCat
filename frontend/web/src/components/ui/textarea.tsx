import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-control border bg-white px-3 py-2 text-body text-ink transition-colors placeholder:text-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}
