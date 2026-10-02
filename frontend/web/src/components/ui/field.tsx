import { Label as LabelPrimitive, Slot } from "radix-ui";
import { useId, type ComponentProps, type ReactElement } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-label font-medium text-muted", className)} {...props} />;
}

interface FieldProps {
  label: string;
  /** Mensaje de error del campo (Zod o `errors` de la API). */
  error?: string;
  ayuda?: string;
  className?: string;
  /** Un solo control: recibe id, aria-invalid y aria-describedby. */
  children: ReactElement;
}

/** Etiqueta + control + ayuda o error, enlazados para lectores de pantalla. */
export function Field({ label, error, ayuda, className, children }: FieldProps) {
  const id = useId();
  const idDescripcion = `${id}-descripcion`;
  const descripcion = error ?? ayuda;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Slot.Root
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion ? idDescripcion : undefined}
      >
        {children}
      </Slot.Root>
      {descripcion && (
        <p id={idDescripcion} className={cn("text-label", error ? "text-danger" : "text-muted")}>
          {descripcion}
        </p>
      )}
    </div>
  );
}
