import { useState } from "react";
import type { CitaPanelDetalle } from "@/api/citas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { mensajeDeError } from "../../errores";
import { useCancelarCita } from "../../hooks/useCita";
import { ResumenCita } from "./ResumenCita";

const MAXIMO = 300;

/**
 * B6 · Cancelar (o rechazar una pendiente). El negocio debe dar el motivo: lo ve el
 * cliente en el aviso. La API libera el horario y cancela los recordatorios.
 */
export function CancelarCitaDialog({
  idNegocio,
  cita,
  rechazar,
  onCerrar,
  onListo,
}: {
  idNegocio: number;
  cita: CitaPanelDetalle;
  rechazar: boolean;
  onCerrar: () => void;
  onListo: (cita: CitaPanelDetalle) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [intentado, setIntentado] = useState(false);
  const cancelar = useCancelarCita(idNegocio);
  const vacio = motivo.trim() === "";
  const errorCampo = cancelar.error?.errors.motivo ?? (intentado && vacio ? "Escribe el motivo" : undefined);
  const errorGeneral =
    cancelar.error && !cancelar.error.errors.motivo ? mensajeDeError(cancelar.error) : null;

  const enviar = () => {
    setIntentado(true);
    if (vacio) return;
    cancelar.mutate({ idCita: cita.id_cita, motivo: motivo.trim(), rechazar }, { onSuccess: onListo });
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle>{rechazar ? "Rechazar cita" : "Cancelar cita"}</DialogTitle>
        <div className="mt-4 flex flex-col gap-4">
          <ResumenCita cita={cita} />
          <Field
            label={`Motivo ${rechazar ? "del rechazo" : "de la cancelación"} * (lo verá el cliente)`}
            error={errorCampo}
            ayuda={`${motivo.length}/${MAXIMO}`}
          >
            <Textarea
              value={motivo}
              maxLength={MAXIMO}
              placeholder={
                rechazar
                  ? "Ej.: ese día no tenemos disponibilidad; te proponemos otra hora por teléfono."
                  : "Ej.: el veterinario tuvo una urgencia; te contactaremos para reagendar."
              }
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
          <Alert tono="info">
            El cliente recibirá un aviso. El horario queda libre y se cancelan los recordatorios programados.
          </Alert>
          {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button variant="danger" cargando={cancelar.isPending} onClick={enviar}>
            {rechazar ? "Rechazar cita" : "Cancelar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
