import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useResponder } from "../hooks/useResenas";
import { respuestaSchema, type RespuestaValores } from "../schemas";
import { MAX_RESPUESTA } from "../textos";

export const AVISO_RESPUESTA =
  "Tu respuesta es pública y habla en nombre del negocio. No incluyas datos del cliente ni información médica de su mascota.";

/** Responder (o editar la respuesta de) una reseña. Con `inicial`, es la edición: tiene Cancelar. */
export function FormRespuesta({
  idResena,
  inicial,
  onListo,
}: {
  idResena: number;
  inicial?: string;
  onListo?: () => void;
}) {
  const negocio = useNegocioActivo();
  const responder = useResponder(negocio.id_negocio);
  const form = useForm<RespuestaValores>({
    resolver: zodResolver(respuestaSchema),
    defaultValues: { respuesta: inicial ?? "" },
  });
  const texto = useWatch({ control: form.control, name: "respuesta" });
  const error = form.formState.errors.respuesta?.message;
  const id = `respuesta-${idResena}`;

  const enviar = form.handleSubmit(({ respuesta }) =>
    responder.mutate(
      { idResena, respuesta, editando: inicial !== undefined },
      {
        onSuccess: () => {
          form.reset({ respuesta: "" });
          onListo?.();
        },
        onError: (e) => aplicarErroresApi(form.setError, e, ["respuesta"]),
      },
    ),
  );

  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-3 flex flex-col gap-1.5" noValidate>
      <Label htmlFor={id} className="sr-only">
        Respuesta pública
      </Label>
      <div className="flex items-start gap-2">
        <Textarea
          id={id}
          rows={inicial ? 3 : 1}
          maxLength={MAX_RESPUESTA}
          placeholder="Escribe una respuesta pública…"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-ayuda`}
          className="min-h-10 flex-1 resize-y"
          {...form.register("respuesta")}
        />
        <Button type="submit" cargando={responder.isPending}>
          {inicial ? "Guardar" : "Responder"}
        </Button>
        {inicial && (
          <Button type="button" variant="secondary" onClick={onListo} disabled={responder.isPending}>
            Cancelar
          </Button>
        )}
      </div>
      <div id={`${id}-ayuda`} className="flex justify-between gap-3 text-label">
        <span className={cn(error ? "text-danger" : "text-muted")}>{error ?? AVISO_RESPUESTA}</span>
        <span className="shrink-0 text-subtle tabular-nums">
          {texto.length} / {MAX_RESPUESTA}
        </span>
      </div>
    </form>
  );
}
