import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInCalendarDays } from "date-fns";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type {
  ActualizarExcepcionBody,
  Excepcion,
  ExcepcionInput,
  TipoExcepcion,
} from "@/api/disponibilidad";
import { toApiError } from "@/api/errors";
import type { CitaAfectada } from "@/api/negocios";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hoyISO, parseFecha } from "@/lib/format";
import { HORAS } from "@/lib/horarios";
import { useGuardarExcepcion, type SedeHorario } from "../hooks/useDisponibilidad";
import { NOMBRE_TIPO } from "../textos";

const GUARDADO: Record<TipoExcepcion, string> = {
  bloqueo: "El bloqueo se registró",
  vacacion: "Las vacaciones se registraron",
  evento_especial: "El evento especial se registró",
};

const fecha = /^\d{4}-\d{2}-\d{2}$/;

const crearSchema = (nueva: boolean) =>
  z
    .object({
      tipo: z.enum(["bloqueo", "vacacion", "evento_especial"]),
      desde: z.string().regex(fecha, "Elige la fecha"),
      hasta: z.string(),
      todoElDia: z.boolean(),
      hora_inicio: z.string(),
      hora_fin: z.string(),
      id_sucursal: z.string(),
      motivo: z.string().trim().max(200, "Máximo 200 caracteres"),
    })
    .superRefine((v, ctx) => {
      const error = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
      const conPeriodo = v.tipo !== "evento_especial";
      if (conPeriodo && v.hasta !== "" && fecha.test(v.desde)) {
        if (!fecha.test(v.hasta)) error("hasta", "Fecha inválida");
        else if (v.hasta < v.desde) error("hasta", "No puede ser anterior al primer día");
        else if (differenceInCalendarDays(parseFecha(v.hasta), parseFecha(v.desde)) > 365)
          error("hasta", "El período no puede pasar de 366 días");
      }
      const ultimo = conPeriodo && v.hasta ? v.hasta : v.desde;
      if (nueva && fecha.test(ultimo) && ultimo < hoyISO()) {
        error(conPeriodo && v.hasta ? "hasta" : "desde", "El último día debe ser hoy o posterior");
      }
      const conHoras = v.tipo === "evento_especial" || (v.tipo === "bloqueo" && !v.todoElDia);
      if (conHoras && v.hora_fin <= v.hora_inicio) error("hora_fin", "Debe ser posterior a la hora de inicio");
      if (v.tipo === "evento_especial" && v.id_sucursal === "") error("id_sucursal", "Elige la sede");
    });

type Valores = z.infer<ReturnType<typeof crearSchema>>;

const CAMPO_DE_API: Record<string, keyof Valores> = {
  fecha_especifica: "desde",
  fecha_fin: "hasta",
  hora_inicio: "hora_inicio",
  hora_fin: "hora_fin",
  id_sucursal: "id_sucursal",
  motivo: "motivo",
};

const hhmm = (hora: string | null | undefined) => (hora ? hora.slice(0, 5) : "");

/**
 * Campos según el tipo, sin `tipo`: un campo que el tipo no tiene da 422 en la API. Al
 * editar se envían todos los del tipo; null vacía (horas en null = bloqueo de días completos).
 */
function camposDe(v: Valores, nueva: boolean): Record<string, string | number | null> {
  const motivo = v.motivo.trim() || null;
  const fin = v.hasta || null;
  if (v.tipo === "evento_especial") {
    return {
      fecha_especifica: v.desde,
      hora_inicio: v.hora_inicio,
      hora_fin: v.hora_fin,
      id_sucursal: Number(v.id_sucursal),
      motivo,
    };
  }
  const periodo = { fecha_especifica: v.desde, ...((fin || !nueva) && { fecha_fin: fin }), motivo };
  if (v.tipo === "vacacion") return periodo;
  if (v.todoElDia) return nueva ? periodo : { ...periodo, hora_inicio: null, hora_fin: null };
  return { ...periodo, hora_inicio: v.hora_inicio, hora_fin: v.hora_fin };
}

/**
 * D6 · Nueva excepción (o editar una): bloqueo, vacaciones o evento especial. Se guarda
 * aunque haya citas en esas fechas; `onGuardada` recibe las que están fuera de la disponibilidad.
 */
export function ExcepcionDialog({
  idEmpleado,
  nombreEmpleado,
  tipoInicial,
  excepcion,
  sedes,
  onCerrar,
  onGuardada,
}: {
  idEmpleado: number;
  nombreEmpleado: string;
  tipoInicial: TipoExcepcion;
  excepcion: Excepcion | null;
  sedes: SedeHorario[];
  onCerrar: () => void;
  onGuardada: (citas: CitaAfectada[], guardado: string) => void;
}) {
  const nueva = excepcion === null;
  const guardar = useGuardarExcepcion(idEmpleado);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyISO();
  const form = useForm<Valores>({
    resolver: zodResolver(crearSchema(nueva)),
    defaultValues: {
      tipo: excepcion?.tipo ?? tipoInicial,
      desde: excepcion?.fecha_especifica ?? hoy,
      hasta: excepcion?.fecha_fin ?? "",
      todoElDia: excepcion ? excepcion.hora_inicio === null : tipoInicial !== "bloqueo",
      hora_inicio: hhmm(excepcion?.hora_inicio) || "08:00",
      hora_fin: hhmm(excepcion?.hora_fin) || "12:00",
      id_sucursal: String(excepcion?.id_sucursal ?? (sedes.length === 1 ? sedes[0]!.id_sucursal : "")),
      motivo: excepcion?.motivo ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [tipo, todoElDia] = useWatch({ control: form.control, name: ["tipo", "todoElDia"] });
  const conHoras = tipo === "evento_especial" || (tipo === "bloqueo" && !todoElDia);

  const onSubmit = form.handleSubmit(async (valores) => {
    setError(null);
    const campos = camposDe(valores, nueva);
    try {
      const { citas_afectadas } = await guardar.mutateAsync(
        nueva
          ? { nueva: { tipo: valores.tipo, ...campos } as ExcepcionInput }
          : { idDisponibilidad: excepcion.id_disponibilidad, cambios: campos as ActualizarExcepcionBody },
      );
      onGuardada(citas_afectadas, nueva ? GUARDADO[valores.tipo] : "Los cambios se guardaron");
    } catch (e) {
      const apiError = toApiError(e);
      let marcados = 0;
      if (apiError.status === 422) {
        for (const [campo, mensaje] of Object.entries(apiError.errors)) {
          const propio = CAMPO_DE_API[campo];
          if (propio) {
            form.setError(propio, { type: "server", message: mensaje });
            marcados += 1;
          }
        }
      }
      if (marcados === 0) setError(apiError.message);
    }
  });

  const selectorHora = (campo: "hora_inicio" | "hora_fin", etiqueta: string, horas: string[]) => (
    <Field label={etiqueta} error={errors[campo]?.message}>
      <NativeSelect {...form.register(campo)}>
        {horas.map((h) => (
          <option key={h}>{h}</option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !isSubmitting && onCerrar()}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle>
          {nueva ? "Nueva excepción" : `Editar ${NOMBRE_TIPO[tipo].toLowerCase()}`} · {nombreEmpleado}
        </DialogTitle>
        <form onSubmit={onSubmit} noValidate className="mt-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
            {nueva && (
              <Tabs
                value={tipo}
                onValueChange={(v) => {
                  form.setValue("tipo", v as TipoExcepcion);
                  form.setValue("todoElDia", v !== "bloqueo");
                  form.clearErrors();
                }}
              >
                <TabsList aria-label="Tipo de excepción">
                  {(Object.keys(NOMBRE_TIPO) as TipoExcepcion[]).map((t) => (
                    <TabsTrigger key={t} value={t}>
                      {NOMBRE_TIPO[t]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <DialogDescription>
              Bloqueo: el profesional no atiende en ese rango. Vacaciones: días completos. Evento especial: suma
              horas extra, incluso fuera del horario de la sede.
            </DialogDescription>

            {tipo === "evento_especial" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha *" error={errors.desde?.message}>
                  <Input type="date" {...form.register("desde")} />
                </Field>
                <Field label="Sede *" error={errors.id_sucursal?.message}>
                  <NativeSelect {...form.register("id_sucursal")}>
                    <option value="">Elige la sede</option>
                    {sedes.map((s) => (
                      <option key={s.id_sucursal} value={s.id_sucursal}>
                        {s.nombre}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde *" error={errors.desde?.message}>
                  <Input type="date" {...form.register("desde")} />
                </Field>
                <Field label="Hasta" error={errors.hasta?.message} ayuda="Vacío: un solo día">
                  <Input type="date" {...form.register("hasta")} />
                </Field>
              </div>
            )}

            {tipo === "bloqueo" && (
              <div className="flex items-center gap-3">
                <Switch
                  id="excepcion-todo-el-dia"
                  checked={todoElDia}
                  onCheckedChange={(v) => form.setValue("todoElDia", v)}
                />
                <Label htmlFor="excepcion-todo-el-dia" className="text-body font-semibold text-ink">
                  Todo el día
                </Label>
              </div>
            )}

            {conHoras && (
              <div className="grid grid-cols-2 gap-3">
                {selectorHora("hora_inicio", "Hora de inicio *", HORAS.slice(0, -1))}
                {selectorHora("hora_fin", "Hora de fin *", HORAS.slice(1))}
              </div>
            )}

            <Field label="Motivo" error={errors.motivo?.message}>
              <Input placeholder={tipo === "evento_especial" ? "Jornada de vacunación" : "Cita médica personal"} {...form.register("motivo")} />
            </Field>

            <Alert tono="advertencia">
              Se guarda aunque tenga citas en esas fechas. Después verás las que están fuera de la disponibilidad
              para reasignarlas o reprogramarlas.
            </Alert>
            {error && <Alert tono="error">{error}</Alert>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" cargando={isSubmitting}>
                {nueva ? `Guardar ${NOMBRE_TIPO[tipo].toLowerCase()}` : "Guardar cambios"}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
