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
import { ESPECIES, type MascotaValores } from "../schemas";

/**
 * Nombre, especie, raza, nacimiento y peso de una mascota (C3 y "Nueva mascota").
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
          <div className="flex flex-col gap-1.5">
            <Label id="especie-mascota">Especie *</Label>
            <div role="radiogroup" aria-labelledby="especie-mascota" className="flex flex-wrap gap-1.5">
              {ESPECIES.map((e) => (
                <button
                  key={e.valor}
                  type="button"
                  role="radio"
                  aria-checked={field.value === e.valor}
                  onClick={() => field.onChange(e.valor)}
                  className={cn(
                    "h-8 rounded-control border px-3 text-body font-medium",
                    field.value === e.valor
                      ? "border-primary bg-primary text-white"
                      : "bg-white text-ink hover:bg-surface",
                  )}
                >
                  {e.texto}
                </button>
              ))}
            </div>
            {errores?.especie && <p className="text-label text-danger">{errores.especie.message}</p>}
          </div>
        )}
      />
      <Field label="Raza" error={errores?.raza?.message}>
        <Input {...register(campo("raza"))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nacimiento" error={errores?.fecha_nacimiento?.message}>
          <Input type="date" {...register(campo("fecha_nacimiento"))} />
        </Field>
        <Field label="Peso (kg)" error={errores?.peso?.message}>
          <Input inputMode="decimal" {...register(campo("peso"))} />
        </Field>
      </div>
    </div>
  );
}
