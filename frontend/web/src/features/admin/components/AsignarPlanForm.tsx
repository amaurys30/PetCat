import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, addYears, format } from "date-fns";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { NegocioAdmin } from "@/api/admin";
import type { Plan } from "@/api/negocios";
import { CampoDinero } from "@/components/common/CampoDinero";
import { Chips } from "@/components/common/Chips";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aplicarErroresApi } from "@/lib/forms";
import { hoyISO, parseFecha } from "@/lib/format";
import { useAsignarPlan } from "../hooks/useAdmin";

type Facturacion = "mensual" | "anual";
/** Como la API: el plan Gratuito no vence. */
const PLAN_GRATUITO = "Gratuito";

/** Mismas reglas que la API: el Gratuito no vence; los demás, con una fecha de fin futura. */
const esquemaDe = (planes: Plan[]) =>
  z
    .object({
      id_plan: z.number({ error: "Elige un plan" }).int().positive(),
      tipo_facturacion: z.enum(["mensual", "anual"]),
      fecha_fin: z.string(),
      monto: z.string(),
      notas: z.string().trim().max(300, "Máximo 300 caracteres"),
    })
    .superRefine((v, ctx) => {
      const gratuito = planes.find((p) => p.id_plan === v.id_plan)?.nombre === PLAN_GRATUITO;
      if (gratuito) return;
      if (!v.fecha_fin)
        ctx.addIssue({ code: "custom", path: ["fecha_fin"], message: "Elige la fecha de fin" });
      else if (v.fecha_fin <= hoyISO())
        ctx.addIssue({ code: "custom", path: ["fecha_fin"], message: "Debe ser una fecha futura" });
    });
type Valores = z.infer<ReturnType<typeof esquemaDe>>;

/** Fin propuesto: un mes o un año desde hoy (lo mismo que la API si no se envía). */
const finPropuesto = (facturacion: Facturacion) => {
  const hoy = parseFecha(hoyISO());
  return format(facturacion === "anual" ? addYears(hoy, 1) : addMonths(hoy, 1), "yyyy-MM-dd");
};
const montoPropuesto = (plan: Plan | undefined, facturacion: Facturacion) =>
  plan ? String(facturacion === "anual" ? plan.precio_anual : plan.precio_mensual) : "0";

/**
 * X1 · Asignar plan. Propone la fecha de fin y el monto según el plan y la facturación hasta
 * que el admin los cambia. El plan Gratuito no lleva fecha de fin.
 */
export function AsignarPlanForm({ negocio, planes }: { negocio: NegocioAdmin; planes: Plan[] }) {
  const asignar = useAsignarPlan();
  const pro = planes.find((p) => p.nombre === "Pro") ?? planes[0];
  const form = useForm<Valores>({
    resolver: zodResolver(esquemaDe(planes)),
    defaultValues: {
      id_plan: pro?.id_plan,
      tipo_facturacion: "mensual",
      fecha_fin: finPropuesto("mensual"),
      monto: montoPropuesto(pro, "mensual"),
      notas: "",
    },
  });
  const idPlan = useWatch({ control: form.control, name: "id_plan" });
  const facturacion = useWatch({ control: form.control, name: "tipo_facturacion" });
  const plan = planes.find((p) => p.id_plan === idPlan);
  const gratuito = plan?.nombre === PLAN_GRATUITO;
  const { dirtyFields, errors } = form.formState;

  // Lo propuesto sigue al plan y a la facturación mientras el admin no lo cambie.
  useEffect(() => {
    if (!dirtyFields.fecha_fin) form.setValue("fecha_fin", finPropuesto(facturacion));
    if (!dirtyFields.monto) form.setValue("monto", montoPropuesto(plan, facturacion));
  }, [plan, facturacion, dirtyFields.fecha_fin, dirtyFields.monto, form]);

  const enviar = form.handleSubmit((v) =>
    asignar.mutate(
      {
        negocio,
        body: {
          id_plan: v.id_plan,
          tipo_facturacion: v.tipo_facturacion,
          ...(!gratuito && { fecha_fin: v.fecha_fin }),
          monto_pagado: Number(v.monto || 0),
          ...(v.notas && { notas: v.notas }),
        },
      },
      {
        onSuccess: () => form.reset({ ...v, notas: "" }),
        onError: (e) =>
          aplicarErroresApi(form.setError, e, ["id_plan", "tipo_facturacion", "fecha_fin", "notas"]) ||
          form.setError("root", { message: e.message }),
      },
    ),
  );

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label>Plan *</Label>
        <Controller
          control={form.control}
          name="id_plan"
          render={({ field }) => (
            <Chips
              etiqueta="Plan"
              valor={String(field.value)}
              onChange={(v) => field.onChange(Number(v))}
              opciones={planes.map((p) => ({ valor: String(p.id_plan), texto: p.nombre }))}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Facturación *</Label>
        <Controller
          control={form.control}
          name="tipo_facturacion"
          render={({ field }) => (
            <Chips
              etiqueta="Facturación"
              valor={field.value}
              onChange={field.onChange}
              opciones={[
                { valor: "mensual", texto: "Mensual" },
                { valor: "anual", texto: "Anual" },
              ]}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {gratuito ? (
          // key: es otro <input> (un date con un texto fijo se quedaría vacío).
          <Field key="sin-fin" label="Fecha de fin" ayuda="El plan Gratuito no vence.">
            <Input value="Sin vencimiento" disabled readOnly />
          </Field>
        ) : (
          <Field key="fecha-fin" label="Fecha de fin" error={errors.fecha_fin?.message}>
            <Input type="date" min={hoyISO()} {...form.register("fecha_fin")} />
          </Field>
        )}
        <Controller
          control={form.control}
          name="monto"
          render={({ field }) => (
            <Field label="Monto pagado (COP)">
              <CampoDinero value={field.value} onChange={field.onChange} />
            </Field>
          )}
        />
      </div>
      <Field label="Notas" error={errors.notas?.message} ayuda="Por ejemplo, la referencia del pago.">
        <Textarea rows={2} maxLength={300} {...form.register("notas")} />
      </Field>
      <Alert tono="info">
        Se cierra la suscripción vigente y se crea una nueva; ambas quedan en el historial, con tu nombre. El
        negocio recibe el cambio al instante.
      </Alert>
      {errors.root && <Alert tono="error">{errors.root.message}</Alert>}
      <Button type="submit" className="self-end" cargando={asignar.isPending}>
        Asignar plan
      </Button>
    </form>
  );
}
