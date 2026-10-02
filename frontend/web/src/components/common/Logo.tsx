import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ claro = false, className }: { claro?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-control",
          claro ? "bg-white/15 text-white" : "bg-primary text-white",
        )}
      >
        <PawPrint className="size-5" aria-hidden />
      </span>
      <span className={cn("text-title font-bold", claro ? "text-white" : "text-ink")}>PetCat</span>
    </span>
  );
}
