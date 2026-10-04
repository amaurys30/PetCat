import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const inputClases =
  "h-10 w-full rounded-control border bg-white px-3 text-body text-ink placeholder:text-subtle transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClases, className)} {...props} />;
}

/** Campo de contraseña con botón para mostrarla. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-muted hover:text-ink"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Lista desplegable nativa con el estilo de los campos (selectores cortos, como horas). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClases, "pr-8", className)} {...props} />;
}
