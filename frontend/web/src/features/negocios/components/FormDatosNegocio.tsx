import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { usePlanes } from "../hooks/useGestion";
import { datosNegocioSchema, type DatosNegocioValores } from "../schemas";
import { textoLimite, TIPOS_NEGOCIO } from "../textos";

/** A6 paso 1: datos básicos del negocio (al crearlo, o al volver desde el paso 2). */
export function FormDatosNegocio({
  iniciales,
  onEnviar,
  enviando,
  error,
  secundario,
  mostrarPlan,
}: {
  iniciales: DatosNegocioValores;
  onEnviar: (valores: DatosNegocioValores, setError: UseFormSetError<DatosNegocioValores>) => void;
  enviando: boolean;
  error: ApiError | null;
  /** Botón de la izquierda: Cancelar o Salir. */
  secundario: ReactNode;
  mostrarPlan?: boolean;
}) {
  const form = useForm<DatosNegocioValores>({
    resolver: zodResolver(datosNegocioSchema),
    defaultValues: iniciales,
  });
  const { errors } = form.formState;

  return (
    <form
      onSubmit={form.handleSubmit((v) => onEnviar(v, form.setError))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field label="Nombre del negocio *" error={errors.nombre?.message}>
        <Input autoFocus {...form.register("nombre")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de negocio *" error={errors.tipo?.message}>
          <NativeSelect {...form.register("tipo")}>
            {Object.entries(TIPOS_NEGOCIO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Teléfono" error={errors.telefono?.message}>
          <Input type="tel" {...form.register("telefono")} />
        </Field>
      </div>
      <Field label="Correo de contacto" error={errors.email?.message}>
        <Input type="email" {...form.register("email")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIT (opcional)" error={errors.nit?.message}>
          <Input placeholder="900.123.456-7" {...form.register("nit")} />
        </Field>
        <Field label="Ciudad *" error={errors.ciudad?.message}>
          <Input {...form.register("ciudad")} />
        </Field>
      </div>

      {mostrarPlan && <AvisoPlanGratuito />}
      {error && error.status !== 422 && <Alert tono="error">{error.message}</Alert>}

      <div className="flex justify-end gap-2">
        {secundario}
        <Button type="submit" cargando={enviando}>
          Continuar <ArrowRight />
        </Button>
      </div>
    </form>
  );
}

/** Límites del plan Gratuito leídos de `GET /planes` (no se escriben a mano). */
function AvisoPlanGratuito() {
  const planes = usePlanes();
  const gratuito = planes.data?.find((p) => p.nombre === "Gratuito");
  const limites = gratuito
    ? `: ${[
        textoLimite(gratuito.limites.sucursales, "sede", "sedes", "sedes ilimitadas"),
        textoLimite(gratuito.limites.empleados, "empleado", "empleados", "empleados ilimitados"),
        textoLimite(gratuito.limites.citas_mes, "cita al mes", "citas al mes", "citas ilimitadas"),
      ].join(", ")}`
    : "";
  return (
    <p className="rounded-control bg-primary-soft px-3 py-2.5 text-label text-primary-dark">
      Empiezas en el plan Gratuito{limites}. Puedes probar Pro gratis desde Suscripción.
    </p>
  );
}
