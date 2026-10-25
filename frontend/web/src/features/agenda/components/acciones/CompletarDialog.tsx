import { useState } from "react";
import type { CitaPanelDetalle } from "@/api/citas";
import { CampoDinero } from "@/components/common/CampoDinero";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { dinero } from "@/lib/format";
import type { Acciones } from "../../acciones";
import { mensajeDeError } from "../../errores";
import { CompletarIncompleto, useCambiarEstado, useCompletar } from "../../hooks/useCita";
import { ResumenCita } from "./ResumenCita";

/**
 * B8 · Completar con el precio final (por defecto el estimado). Desde una cita confirmada
 * que ya empezó, pasa por en curso y la completa en dos llamadas seguidas: si la segunda
 * falla, la cita queda en curso y el botón reintenta solo completar. Abajo, "No asistió"
 * (desde la hora de inicio). Con historial_medico.crear, la casilla "Crear el registro médico al
 * terminar" (desmarcada) abre C4 con la cita al completarla.
 */
export function CompletarDialog({
  idNegocio,
  cita,
  acciones,
  ofrecerRegistro = false,
  onCerrar,
  onListo,
}: {
  idNegocio: number;
  cita: CitaPanelDetalle;
  acciones: Acciones;
  /** Con historial_medico.crear: casilla "Crear el registro médico al terminar". */
  ofrecerRegistro?: boolean;
  onCerrar: () => void;
  /** El aviso lo muestra el hook; `crearRegistro`: abrir C4 con la cita. */
  onListo: (cita: CitaPanelDetalle, crearRegistro: boolean) => void;
}) {
  // Desmarcada: no toda cita es clínica (baño, guardería) y marcada abriría C4 cada vez.
  const [crearRegistro, setCrearRegistro] = useState(false);
  const [precio, setPrecio] = useState(String(Math.round(cita.precio_estimado)));
  const [intentado, setIntentado] = useState(false);
  const completar = useCompletar(idNegocio);
  const estado = useCambiarEstado(idNegocio);
  const sinPrecio = precio === "";

  const incompleto = completar.error instanceof CompletarIncompleto ? completar.error : null;
  const error = incompleto ? null : mensajeDeError(completar.error ?? estado.error);
  // Si el segundo paso falló, el detalle por campo viene en el error de la API que trae dentro.
  const errorPrecio = (incompleto?.causa ?? completar.error)?.errors.precio_final;

  const enviar = () => {
    setIntentado(true);
    if (sinPrecio) return;
    completar.mutate(
      { cita, precioFinal: Number(precio) },
      { onSuccess: (c) => onListo(c, ofrecerRegistro && crearRegistro) },
    );
  };
  const noAsistio = () =>
    estado.mutate({ idCita: cita.id_cita, estado: "no_asistio" }, { onSuccess: (c) => onListo(c, false) });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle>Completar cita</DialogTitle>
        <div className="mt-4 flex flex-col gap-4">
          <ResumenCita cita={cita} />
          <Field
            label="Precio final (COP) *"
            error={intentado && sinPrecio ? "Escribe el precio final" : errorPrecio}
            ayuda={`Precio estimado al reservar: ${dinero(cita.precio_estimado)}. Cámbialo si hubo procedimientos adicionales.`}
          >
            <CampoDinero value={precio} onChange={setPrecio} />
          </Field>
          {ofrecerRegistro && (
            <label className="flex items-start gap-2.5 text-body text-ink">
              <Checkbox
                checked={crearRegistro}
                onCheckedChange={(v) => setCrearRegistro(v === true)}
                className="mt-0.5"
              />
              <span>
                Crear el registro médico al terminar
                <span className="block text-label text-muted">
                  {cita.registros_medicos.length > 0
                    ? "Esta cita ya tiene un registro; puedes crear otro, por ejemplo para un examen."
                    : "Se abre con la cita, la fecha y el profesional ya puestos."}
                </span>
              </span>
            </label>
          )}
          {cita.cliente.usa_app && (
            <Alert tono="exito">
              Unas horas después, {cita.cliente.nombre} recibirá en la app la invitación para reseñar la
              visita.
            </Alert>
          )}
          {incompleto && (
            <Alert tono="advertencia">
              La cita quedó en curso, pero no se pudo completar: {incompleto.causa.message} Revisa el precio y
              vuelve a intentarlo.
            </Alert>
          )}
          {error && <Alert tono="error">{error}</Alert>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button cargando={completar.isPending} disabled={estado.isPending} onClick={enviar}>
            Completar cita
          </Button>
        </DialogFooter>

        {acciones.noAsistio && (
          <div className="mt-5 rounded-control bg-surface p-4">
            <p className="text-body font-semibold text-ink">¿El cliente no llegó?</p>
            <p className="mt-1 text-label text-muted">
              “No asistió” se habilita desde la hora de inicio y cuenta en el historial del cliente. Si llega
              tarde el mismo día, podrás pasarla a “En curso”.
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              cargando={estado.isPending}
              disabled={completar.isPending}
              onClick={noAsistio}
            >
              Marcar como no asistió
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
