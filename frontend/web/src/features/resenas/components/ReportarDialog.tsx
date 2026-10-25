import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ResenaPanel } from "@/api/resenas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useReportar } from "../hooks/useResenas";
import { reporteSchema, type ReporteValores } from "../schemas";
import { MAX_DETALLE_REPORTE, MOTIVOS_REPORTE } from "../textos";

/** Reporte a la moderación de PetCat: una vez por reseña; la reseña sigue publicada y cuenta. */
export function ReportarDialog({ resena, onCerrar }: { resena: ResenaPanel | null; onCerrar: () => void }) {
  const negocio = useNegocioActivo();
  const reportar = useReportar(negocio.id_negocio);
  const form = useForm<ReporteValores>({
    resolver: zodResolver(reporteSchema),
    defaultValues: { detalle: "" },
  });
  const motivo = useWatch({ control: form.control, name: "motivo" });
  const cerrar = () => {
    form.reset({ detalle: "" });
    onCerrar();
  };

  const enviar = form.handleSubmit(({ motivo, detalle }) => {
    if (!resena) return;
    reportar.mutate(
      { idResena: resena.id_resena, motivo, ...(detalle && { detalle }) },
      {
        onSuccess: cerrar,
        // Un 409 (ya reportada) lo avisa el manejo global; el diálogo se cierra.
        onError: (e) => {
          if (!aplicarErroresApi(form.setError, e, ["motivo", "detalle"])) cerrar();
        },
      },
    );
  });

  return (
    <Dialog open={resena !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle>Reportar reseña</DialogTitle>
        <DialogDescription className="mt-2">
          {resena ? `Reseña de ${resena.autor}. ` : ""}PetCat la revisará.
        </DialogDescription>
        <Alert tono="info" className="mt-4">
          La reseña sigue publicada y cuenta en tu calificación hasta que PetCat la revise: reportar no sirve
          para ocultar críticas. Solo se puede reportar una vez.
        </Alert>
        <form
          id="reportar-resena"
          onSubmit={(e) => void enviar(e)}
          className="mt-4 flex flex-col gap-4"
          noValidate
        >
          <Controller
            control={form.control}
            name="motivo"
            render={({ field, fieldState }) => (
              <fieldset>
                <legend className="text-label font-medium text-muted">Motivo</legend>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {MOTIVOS_REPORTE.map((m) => (
                    <label
                      key={m.valor}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-body",
                        field.value === m.valor ? "border-primary bg-selected" : "hover:bg-surface",
                      )}
                    >
                      <input
                        type="radio"
                        name="motivo"
                        value={m.valor}
                        checked={field.value === m.valor}
                        onChange={() => field.onChange(m.valor)}
                        className="accent-primary"
                      />
                      {m.texto}
                    </label>
                  ))}
                </div>
                {fieldState.error && (
                  <p className="mt-1 text-label text-danger">{fieldState.error.message}</p>
                )}
              </fieldset>
            )}
          />
          <Field
            label={motivo === "otro" ? "Detalle *" : "Detalle (opcional)"}
            error={form.formState.errors.detalle?.message}
          >
            <Textarea rows={3} maxLength={MAX_DETALLE_REPORTE} {...form.register("detalle")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={cerrar} disabled={reportar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="reportar-resena" variant="danger" cargando={reportar.isPending}>
            Reportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
