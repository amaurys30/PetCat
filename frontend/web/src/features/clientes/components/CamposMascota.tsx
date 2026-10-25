import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ESPECIES, SEXOS, type MascotaValores } from "../schemas";

/** Botones de una sola opción (especie, sexo). */
function Opciones({
  id,
  etiqueta,
  opciones,
  valor,
  onChange,
  error,
}: {
  id: string;
  etiqueta: string;
  opciones: readonly { valor: string; texto: string }[];
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>{etiqueta}</Label>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className={cn(
              "h-8 rounded-control border px-3 text-body font-medium",
              valor === o.valor
                ? "border-primary bg-primary text-white"
                : "bg-white text-ink hover:bg-surface",
            )}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  );
}

/**
 * Nombre, especie, raza, sexo, nacimiento y peso de una mascota (C3 y "Nueva mascota").
 * `prefijo`: dónde están los campos en el formulario ("mascota." o "").
 */
export function CamposMascota<T extends FieldValues>({
  control,
  register,
  errores,
  prefijo,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  errores: FieldErrors<MascotaValores> | undefined;
  prefijo: "" | "mascota.";
}) {
  const campo = (nombre: keyof MascotaValores) => `${prefijo}${nombre}` as Path<T>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Field label="Nombre *" error={errores?.nombre?.message}>
        <Input {...register(campo("nombre"))} />
      </Field>
      <Controller
        control={control}
        name={campo("especie")}
        render={({ field }) => (
          <Opciones
            id="especie-mascota"
            etiqueta="Especie *"
            opciones={ESPECIES}
            valor={field.value}
            onChange={field.onChange}
            error={errores?.especie?.message}
          />
        )}
      />
      <Field label="Raza" error={errores?.raza?.message}>
        <Input {...register(campo("raza"))} />
      </Field>
      <Controller
        control={control}
        name={campo("sexo")}
        render={({ field }) => (
          <Opciones
            id="sexo-mascota"
            etiqueta="Sexo"
            opciones={SEXOS}
            valor={field.value}
            onChange={field.onChange}
            error={errores?.sexo?.message}
          />
        )}
      />
      <Field label="Nacimiento" error={errores?.fecha_nacimiento?.message}>
        <Input type="date" {...register(campo("fecha_nacimiento"))} />
      </Field>
      <Field label="Peso (kg)" error={errores?.peso?.message}>
        <Input inputMode="decimal" {...register(campo("peso"))} />
      </Field>
    </div>
  );
}
