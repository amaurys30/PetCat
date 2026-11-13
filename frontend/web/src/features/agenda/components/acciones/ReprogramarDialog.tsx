import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import type { Cita, CitaPanelDetalle } from "@/api/citas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSedes } from "@/features/equipo/hooks/useDisponibilidad";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { encabezadoDia, fechaHoraCita, sumarDias } from "@/lib/agenda";
import { dinero, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { abiertosDelDia } from "../../calculos";
import { mensajeDeError } from "../../errores";
import { useProfesionales } from "../../hooks/useAgenda";
import { useHorariosLibres, useReprogramarCita } from "../../hooks/useCita";
import { nombreCompleto } from "../../textos";
import { ResumenCita } from "./ResumenCita";
import { SelectorHorarios } from "../SelectorHorarios";

const CUALQUIERA = "cualquiera";

/**
 * B7 · Reprogramar: nueva fecha (los próximos días en que abre la sede, u otra), sede,
 * profesional y uno de los horarios libres del panel, sin contar la propia cita. Se crea
 * una cita nueva confirmada y la actual queda reprogramada. Un 409 (otro tomó el horario)
 * recarga los horarios; el 403 del plan abre el diálogo de Pro.
 */
export function ReprogramarDialog({
  cita,
  onCerrar,
  onListo,
}: {
  cita: CitaPanelDetalle;
  onCerrar: () => void;
  onListo: (nueva: Cita) => void;
}) {
  const negocio = useNegocioActivo();
  const { sedes } = useSedes();
  const profesionales = useProfesionales(negocio.id_negocio);
  const reprogramar = useReprogramarCita(negocio.id_negocio);
  // Sin citas.ver_todas se reprograma a nombre de quien lo hace (la API lo exige).
  const puede = usePuede();
  const verTodas = puede("citas", "ver_todas");
  const hoy = hoyISO();

  const [idSucursal, setIdSucursal] = useState<number | undefined>(cita.sucursal?.id_sucursal);
  const sede = sedes?.find((s) => s.id_sucursal === idSucursal) ?? sedes?.[0];
  const proximos = useMemo(() => {
    const dias: string[] = [];
    for (let i = 0; i < 21 && dias.length < 4; i++) {
      const d = sumarDias(hoy, i);
      if (!sede || abiertosDelDia([sede], d).length > 0) dias.push(d);
    }
    return dias;
  }, [hoy, sede]);
  const [fecha, setFecha] = useState(cita.fecha >= hoy ? cita.fecha : hoy);
  const [empleado, setEmpleado] = useState(
    verTodas || negocio.id_empleado === null ? CUALQUIERA : String(negocio.id_empleado),
  );
  const [horaElegida, setHoraElegida] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const quienes = (profesionales.data ?? []).filter((p) =>
    p.servicios.some((s) => s.id_servicio === cita.servicio.id_servicio),
  );
  const horarios = useHorariosLibres(
    negocio.id_negocio,
    sede && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= hoy
      ? {
          id_servicio: cita.servicio.id_servicio,
          id_sucursal: sede.id_sucursal,
          fecha,
          id_empleado: empleado === CUALQUIERA ? undefined : Number(empleado),
          id_cita_excluir: cita.id_cita,
          id_mascota: cita.mascota.id_mascota,
        }
      : null,
  );
  // El 409 (otro tomó el horario) se muestra aquí y los horarios se recargan.
  const error = mensajeDeError(reprogramar.error) ?? (horarios.isError ? horarios.error.message : null);

  const cambiar = (cambio: () => void) => {
    cambio();
    setHoraElegida(null);
    reprogramar.reset();
  };

  const enviar = () => {
    if (!horaElegida || !sede) return;
    reprogramar.mutate(
      {
        idCita: cita.id_cita,
        fecha,
        hora_inicio: horaElegida,
        id_empleado: empleado === CUALQUIERA ? undefined : Number(empleado),
        id_sucursal: sede.id_sucursal !== cita.sucursal?.id_sucursal ? sede.id_sucursal : undefined,
        motivo: motivo.trim() || undefined,
      },
      {
        onSuccess: onListo,
        onError: (e) => {
          if (e.status === 409) {
            setHoraElegida(null);
            void horarios.refetch();
          }
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      {/* Título y botones fijos; lo de en medio se desplaza si no cabe (muchos horarios, pantallas bajas). */}
      <DialogContent className="flex max-h-[92vh] max-w-[620px] flex-col">
        <DialogTitle>Reprogramar cita</DialogTitle>
        <div className="-mx-1 mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
          <ResumenCita
            cita={cita}
            detalle={[
              `Actual: ${fechaHoraCita(cita.fecha, cita.hora_inicio)}`,
              cita.empleado && nombreCompleto(cita.empleado),
              dinero(cita.precio_estimado),
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          <div className="flex flex-col gap-1.5">
            <Label>Nueva fecha</Label>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Nueva fecha">
              {proximos.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={fecha === d}
                  onClick={() => cambiar(() => setFecha(d))}
                  className={cn(
                    "h-8 rounded-control border px-3 text-body font-medium",
                    fecha === d
                      ? "border-primary bg-primary text-white"
                      : "bg-white text-ink hover:bg-surface",
                  )}
                >
                  {encabezadoDia(d)}
                </button>
              ))}
              <label className="relative flex items-center">
                <span className="sr-only">Otra fecha</span>
                <CalendarDays
                  className="pointer-events-none absolute left-2.5 size-4 text-muted"
                  aria-hidden
                />
                <Input
                  type="date"
                  min={hoy}
                  value={fecha}
                  onChange={(e) => cambiar(() => setFecha(e.target.value))}
                  className={cn("h-8 w-40 pl-8", !proximos.includes(fecha) && "border-primary")}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sede">
              <Select
                value={sede ? String(sede.id_sucursal) : undefined}
                onValueChange={(v) => cambiar(() => setIdSucursal(Number(v)))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sede" />
                </SelectTrigger>
                <SelectContent>
                  {(sedes ?? []).map((s) => (
                    <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Profesional">
              <Select
                value={empleado}
                onValueChange={(v) => cambiar(() => setEmpleado(v))}
                disabled={!verTodas}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verTodas && <SelectItem value={CUALQUIERA}>Cualquier profesional</SelectItem>}
                  {quienes
                    .filter((p) => verTodas || p.id_empleado === negocio.id_empleado)
                    .map((p) => (
                      <SelectItem key={p.id_empleado} value={String(p.id_empleado)}>
                        {nombreCompleto(p)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Horarios libres · {/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? encabezadoDia(fecha) : "elige una fecha"}
            </Label>
            {horarios.isPending && horarios.fetchStatus !== "idle" ? (
              <Skeleton etiqueta="Cargando horarios libres" className="h-16" />
            ) : horarios.data && horarios.data.horarios.length > 0 ? (
              <SelectorHorarios
                horarios={horarios.data.horarios}
                elegido={horaElegida}
                onElegir={setHoraElegida}
              />
            ) : horarios.data ? (
              <p className="text-body text-muted">{horarios.data.motivo_sin_horarios}</p>
            ) : null}
          </div>

          <Field label="Motivo (opcional)">
            <Input
              value={motivo}
              maxLength={300}
              placeholder="Ej.: el cliente pidió cambiar la hora"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>

          <Alert tono="info">
            Se crea una cita nueva, confirmada porque la reprograma el negocio. La actual queda como
            “Reprogramada” y se conserva el precio de {dinero(cita.precio_estimado)}.
          </Alert>
          {error && <Alert tono="error">{error}</Alert>}
        </div>
        <DialogFooter className="mt-4 shrink-0">
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={!horaElegida} cargando={reprogramar.isPending} onClick={enviar}>
            {horaElegida ? `Reprogramar a ${encabezadoDia(fecha)}, ${horaElegida}` : "Reprogramar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
