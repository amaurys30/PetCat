import { iniciales } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAMANOS = {
  sm: "size-7 text-[10px]",
  md: "size-8 text-label",
  lg: "size-10 text-body",
  xl: "size-16 text-[22px]",
} as const;

/** Foto (miniatura) o iniciales sobre el color primario. */
export function Avatar({
  nombre,
  fotoUrl,
  tamano = "md",
  tono = "solido",
  className,
}: {
  nombre: string;
  fotoUrl?: string | null;
  tamano?: keyof typeof TAMANOS;
  tono?: "solido" | "suave";
  className?: string;
}) {
  const clases = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
    TAMANOS[tamano],
    tono === "solido" ? "bg-primary text-white" : "bg-primary-soft text-primary-dark",
    className,
  );
  if (fotoUrl) return <img src={fotoUrl} alt="" className={cn(clases, "object-cover")} />;
  return (
    <span className={clases} aria-hidden>
      {iniciales(nombre)}
    </span>
  );
}
