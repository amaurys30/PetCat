import { zodResolver } from "@hookform/resolvers/zod";
import { Syringe, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ApiError } from "@/api/errors";
import {
  MAX_ARCHIVOS_REGISTRO,
  TIPOS_HISTORIAL,
  type ArchivoPrivado,
  type CitaDeMascota,
  type RegistroHistorial,
  type TipoHistorial,
} from "@/api/salud";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SelectorArchivos } from "@/components/common/SelectorArchivos";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { aviso } from "@/components/ui/toaster";
import { useProfesionales } from "@/features/agenda/hooks/useAgenda";
import { nombreCompleto } from "@/features/agenda/textos";
import { diaYHora } from "@/features/clientes/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { fechaCorta, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUi, type InicioRegistroMedico } from "@/stores/ui";
import {
  useCitasMascota,
  useCrearRegistro,
  useEditarRegistro,
  useEliminarArchivo,
  useResumenSalud,
  useSubirArchivos,
} from "../hooks/useSalud";
import {
  CAMPO_DE_API,
  cambiosApi,
  nuevoRegistroApi,
  problemaArchivo,
  registroSchema,
  valoresDe,
  type RegistroValores,
} from "../schemas";
import { TIPO_HISTORIAL, textoTipo } from "../textos";

/** Tipos con botón (como el mockup); los demás van en "Más". */
const PRINCIPALES: TipoHistorial[] = [
  "consulta_general",
  "control",
  "vacunacion",
  "cirugia",
  "urgencia",
  "examen_laboratorio",
];
const TEXTO_BOTON: Partial<Record<TipoHistorial, string>> = { examen_laboratorio: "Examen" };
const SIN_CITA = "sin_cita";
const SIN_PROFESIONAL = "sin_profesional";

type Fase =
  | { tipo: "formulario" }
  /** El registro se guardó pero faltan archivos por subir (falló un envío). */
  | { tipo: "faltan_archivos"; registro: RegistroHistorial; faltan: File[]; error: string }
  /** Registro de vacunación guardado: ofrece registrarla también en el carnet. */
  | { tipo: "ofrecer_carnet"; registro: RegistroHistorial };

/** Lo pinta PanelLayout cuando el store tiene un registro por crear o editar. */
export function RegistroMedicoHost() {
  const inicio = useUi((s) => s.registroMedico);
  const cerrar = useUi((s) => s.cerrarRegistroMedico);
  if (!inicio) return null;
  return (
    <RegistroMedicoDialog
      key={inicio.registro?.id_historial ?? `nuevo-${inicio.idCita ?? ""}`}
      inicio={inicio}
      onCerrar={cerrar}
    />
  );
}

/**
 * C4 · Nuevo registro médico o edición de uno propio. Primero se guarda el registro y después
 * se suben sus archivos (privados) de a 5: si un envío falla, el registro ya existe y el
 * diálogo dice qué falta y permite reintentar. Un registro de vacunación ofrece al final
 * registrarla también en el carnet (C5, vinculada a este registro).
 */
export function RegistroMedicoDialog({
  inicio,
  onCerrar,
}: {
  inicio: InicioRegistroMedico;
  onCerrar: () => void;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const resumen = useResumenSalud(negocio.id_negocio, inicio.idMascota);
  const editando = inicio.registro;
  const [fase, setFase] = useState<Fase>({ tipo: "formulario" });

  const titulo = `${editando ? "Editar registro médico" : "Nuevo registro médico"}${resumen.data ? ` · ${resumen.data.mascota.nombre}` : ""}`;
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto">
        <DialogTitle>{titulo}</DialogTitle>
        {resumen.isPending ? (
          <Skeleton className="mt-4 h-80" />
        ) : resumen.isError ? (
          <Alert tono="error" className="mt-4">
            {resumen.error.message}
          </Alert>
        ) : fase.tipo === "ofrecer_carnet" ? (
          <OfrecerCarnet
            registro={fase.registro}
            puedeVacunas={puede("vacunas", "crear")}
            onCerrar={onCerrar}
          />
        ) : (
          <Formulario
            inicio={inicio}
            mascota={resumen.data.mascota}
            fase={fase}
            setFase={setFase}
            onCerrar={onCerrar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  inicio,
  mascota,
  fase,
  setFase,
  onCerrar,
}: {
  inicio: InicioRegistroMedico;
  mascota: {
    id_mascota: number;
    tiene_alergias: boolean;
    alergias_detalle: string | null;
    condiciones_medicas: string | null;
  };
  fase: Fase;
  setFase: (fase: Fase) => void;
  onCerrar: () => void;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const editando = inicio.registro;
  const verCitas = puede("citas", "ver") || puede("clientes", "ver");
  // Solo las atendidas (en curso o completadas): el registro es de una atención, y así las
  // citas futuras o canceladas no llenan la primera página.
  const citas = useCitasMascota(
    negocio.id_negocio,
    inicio.idMascota,
    verCitas && !editando,
    "en_curso,completada",
  );
  const profesionales = useProfesionales(negocio.id_negocio, puede("citas", "ver"));
  const crear = useCrearRegistro(negocio.id_negocio);
  const editar = useEditarRegistro(negocio.id_negocio);
  const subir = useSubirArchivos(negocio.id_negocio);
  const eliminar = useEliminarArchivo(negocio.id_negocio);
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [archivoABorrar, setArchivoABorrar] = useState<ArchivoPrivado | null>(null);
  // En edición, los archivos se ven y se quitan al momento (el registro ya existe).
  const [actual, setActual] = useState<RegistroHistorial | undefined>(editando);

  const original: RegistroValores = editando
    ? valoresDe(editando)
    : {
        tipo: "consulta_general",
        idCita: inicio.idCita ? String(inicio.idCita) : "",
        fecha: inicio.fecha && inicio.fecha <= hoyISO() ? inicio.fecha : hoyISO(),
        idEmpleado: inicio.idEmpleado ? String(inicio.idEmpleado) : "",
        motivo: "",
        diagnostico: "",
        tratamiento: "",
        medicamentos: "",
        indicaciones: "",
        peso: "",
        temperatura: "",
        fc: "",
        fr: "",
        proximoControl: "",
        notasInternas: "",
      };
  const form = useForm<RegistroValores>({ resolver: zodResolver(registroSchema), defaultValues: original });
  const { errors } = form.formState;
  const [tipo, idCita] = useWatch({ control: form.control, name: ["tipo", "idCita"] });

  // Citas que se pueden vincular: las atendidas de este negocio con la mascota (nunca futuras).
  const vinculables = (citas.data?.pages.flatMap((p) => p.data) ?? []).filter((c) => c.fecha <= hoyISO());
  const citaElegida: CitaDeMascota | undefined = vinculables.find((c) => String(c.id_cita) === idCita);
  const yaTieneRegistro = !editando ? citaElegida?.registros_medicos[0] : undefined;
  const existentes = actual?.archivos.length ?? 0;
  const cupo = MAX_ARCHIVOS_REGISTRO - existentes - pendientes.length;
  const ocupado = crear.isPending || editar.isPending || subir.isPending;

  const terminar = (registro: RegistroHistorial) => {
    if (!editando && registro.tipo === "vacunacion") {
      setFase({ tipo: "ofrecer_carnet", registro });
      return;
    }
    aviso.exito(editando ? "Registro médico actualizado" : "Registro médico guardado");
    onCerrar();
  };

  /** Sube los archivos pendientes; si un envío falla, el registro ya existe y quedan los que faltan. */
  const subirPendientes = async (registro: RegistroHistorial, archivos: File[]) => {
    if (archivos.length === 0) return terminar(registro);
    try {
      const conArchivos = await subir.mutateAsync({ idHistorial: registro.id_historial, archivos });
      setPendientes([]);
      terminar(conArchivos ?? registro);
    } catch (error) {
      const e = error as ApiError & { subidos?: number };
      setPendientes([]);
      setActual(registro);
      setFase({
        tipo: "faltan_archivos",
        registro,
        faltan: archivos.slice(e.subidos ?? 0),
        error: e.message,
      });
    }
  };

  const aplicarErrores = (error: ApiError) => {
    let alguno = false;
    for (const [campo, mensaje] of Object.entries(error.errors ?? {})) {
      const destino = CAMPO_DE_API[campo];
      if (destino) {
        form.setError(destino, { message: mensaje });
        alguno = true;
      }
    }
    if (!alguno) setErrorGeneral(error.message);
  };

  const guardar = form.handleSubmit(async (valores) => {
    setErrorGeneral(null);
    try {
      if (editando) {
        const cambios = cambiosApi(valores, original);
        const registro =
          Object.keys(cambios).length > 0
            ? await editar.mutateAsync({ idHistorial: editando.id_historial, cambios })
            : (actual ?? editando);
        await subirPendientes(registro, pendientes);
      } else {
        const registro = await crear.mutateAsync(nuevoRegistroApi(valores, inicio.idMascota));
        await subirPendientes(registro, pendientes);
      }
    } catch (error) {
      aplicarErrores(error as ApiError);
    }
  });

  if (fase.tipo === "faltan_archivos") {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <Alert tono="advertencia">
          El registro se guardó, pero no se pudieron subir{" "}
          {fase.faltan.length === 1 ? "este archivo" : `estos ${fase.faltan.length} archivos`}:{" "}
          {fase.faltan.map((a) => a.name).join(", ")}. {fase.error}
        </Alert>
        <DialogFooter>
          <Button variant="secondary" onClick={() => terminar(fase.registro)}>
            Terminar sin ellos
          </Button>
          <Button cargando={subir.isPending} onClick={() => void subirPendientes(fase.registro, fase.faltan)}>
            Reintentar la subida
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} noValidate className="mt-2 flex flex-col gap-4">
      {(mascota.tiene_alergias || mascota.condiciones_medicas) && (
        <div className="flex flex-wrap gap-2">
          {mascota.tiene_alergias && (
            <Badge tono="danger">
              <TriangleAlert className="size-3" aria-hidden /> Alergia:{" "}
              {mascota.alergias_detalle ?? "sin detalle"}
            </Badge>
          )}
          {mascota.condiciones_medicas && (
            <Badge tono="warning">Condición: {mascota.condiciones_medicas}</Badge>
          )}
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-label font-medium text-ink">Tipo *</legend>
        <Controller
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Tipo">
              {PRINCIPALES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={field.value === t}
                  onClick={() => field.onChange(t)}
                  className={cn(
                    "h-8 rounded-control border px-3 text-body font-medium",
                    field.value === t
                      ? "border-primary bg-primary text-white"
                      : "bg-white text-ink hover:border-primary",
                  )}
                >
                  {TEXTO_BOTON[t] ?? TIPO_HISTORIAL[t]}
                </button>
              ))}
              <Select
                value={PRINCIPALES.includes(field.value) ? "" : field.value}
                onValueChange={(v) => field.onChange(v as TipoHistorial)}
              >
                <SelectTrigger
                  aria-label="Más tipos"
                  className={cn(
                    "h-8 w-44",
                    !PRINCIPALES.includes(field.value) && "border-primary text-primary-dark",
                  )}
                >
                  <SelectValue placeholder="Más tipos" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_HISTORIAL.filter((t) => !PRINCIPALES.includes(t)).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_HISTORIAL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
        {errors.tipo && <p className="mt-1 text-label text-danger">{errors.tipo.message}</p>}
      </fieldset>

      <div className="grid grid-cols-[minmax(0,1fr)_170px_200px] gap-3">
        {editando ? (
          <Field label="Cita vinculada">
            <Input
              value={editando.id_cita ? `Cita del ${fechaCorta(editando.fecha)}` : "Sin cita"}
              disabled
            />
          </Field>
        ) : (
          <Field
            label="Vincular a una cita"
            error={errors.idCita?.message}
            ayuda={!verCitas ? "Tu rol no ve las citas: el registro queda sin cita." : undefined}
          >
            <Controller
              control={form.control}
              name="idCita"
              render={({ field }) => (
                <Select
                  value={field.value || SIN_CITA}
                  disabled={!verCitas}
                  onValueChange={(v) => {
                    const valor = v === SIN_CITA ? "" : v;
                    field.onChange(valor);
                    const cita = vinculables.find((c) => String(c.id_cita) === valor);
                    // La cita trae su fecha y su profesional.
                    if (cita) {
                      form.setValue("fecha", cita.fecha, { shouldValidate: true });
                      if (cita.empleado) form.setValue("idEmpleado", String(cita.empleado.id_empleado));
                    }
                  }}
                >
                  <SelectTrigger aria-label="Vincular a una cita">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_CITA}>Sin cita</SelectItem>
                    {vinculables.map((c) => (
                      <SelectItem key={c.id_cita} value={String(c.id_cita)}>
                        {diaYHora(c)} · {c.servicio.nombre}
                        {c.registros_medicos.length > 0 && " · con registro"}
                      </SelectItem>
                    ))}
                    {/* La cita de B8 aunque la lista aún no haya cargado. */}
                    {inicio.idCita && !vinculables.some((c) => c.id_cita === inicio.idCita) && (
                      <SelectItem value={String(inicio.idCita)}>
                        {inicio.fecha ? `Cita del ${fechaCorta(inicio.fecha)}` : "Cita de la atención"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
        <Field label="Fecha *" error={errors.fecha?.message}>
          <Input type="date" max={hoyISO()} {...form.register("fecha")} />
        </Field>
        <Field label="Profesional" error={errors.idEmpleado?.message}>
          <Controller
            control={form.control}
            name="idEmpleado"
            render={({ field }) => (
              <Select
                value={field.value || SIN_PROFESIONAL}
                onValueChange={(v) => field.onChange(v === SIN_PROFESIONAL ? "" : v)}
              >
                <SelectTrigger aria-label="Profesional">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PROFESIONAL}>
                    {editando ? "Sin profesional" : "Yo (quien registra)"}
                  </SelectItem>
                  {(profesionales.data ?? []).map((p) => (
                    <SelectItem key={p.id_empleado} value={String(p.id_empleado)}>
                      {nombreCompleto(p)}
                    </SelectItem>
                  ))}
                  {/* El profesional del registro o de la cita, aunque ya no esté en la lista. */}
                  {field.value &&
                    !(profesionales.data ?? []).some((p) => String(p.id_empleado) === field.value) && (
                      <SelectItem value={field.value}>
                        {editando?.empleado && String(editando.empleado.id_empleado) === field.value
                          ? nombreCompleto(editando.empleado)
                          : "Profesional de la cita"}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      {yaTieneRegistro && (
        <Alert tono="advertencia">
          Esta cita ya tiene un registro ({textoTipo(yaTieneRegistro.tipo)},{" "}
          {fechaCorta(yaTieneRegistro.fecha)}). Puedes crear otro, por ejemplo para un examen.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Motivo de consulta" error={errors.motivo?.message}>
          <Textarea rows={2} {...form.register("motivo")} />
        </Field>
        <Field label="Diagnóstico" error={errors.diagnostico?.message}>
          <Textarea rows={2} {...form.register("diagnostico")} />
        </Field>
        <Field label="Tratamiento" error={errors.tratamiento?.message}>
          <Textarea rows={2} {...form.register("tratamiento")} />
        </Field>
        <Field label="Medicamentos" error={errors.medicamentos?.message}>
          <Textarea rows={2} {...form.register("medicamentos")} />
        </Field>
      </div>
      <Field label="Indicaciones para el dueño" error={errors.indicaciones?.message}>
        <Textarea rows={2} {...form.register("indicaciones")} />
      </Field>

      <div className="grid grid-cols-5 gap-3">
        <Field label="Peso (kg)" error={errors.peso?.message}>
          <Input inputMode="decimal" {...form.register("peso")} />
        </Field>
        <Field label="Temperatura (°C)" error={errors.temperatura?.message}>
          <Input inputMode="decimal" {...form.register("temperatura")} />
        </Field>
        <Field label="Frec. cardiaca" error={errors.fc?.message}>
          <Input inputMode="numeric" placeholder="lpm" {...form.register("fc")} />
        </Field>
        <Field label="Frec. respiratoria" error={errors.fr?.message}>
          <Input inputMode="numeric" placeholder="rpm" {...form.register("fr")} />
        </Field>
        <Field label="Próximo control" error={errors.proximoControl?.message}>
          <Input type="date" {...form.register("proximoControl")} />
        </Field>
      </div>

      <Field label="Notas internas (solo las ve tu negocio)" error={errors.notasInternas?.message}>
        <Textarea rows={2} placeholder="Observaciones para el equipo…" {...form.register("notasInternas")} />
      </Field>

      {actual && actual.archivos.length > 0 && (
        <div>
          <p className="mb-1.5 text-label font-medium text-ink">Archivos del registro</p>
          <ul className="flex flex-wrap gap-2" aria-label="Archivos del registro">
            {actual.archivos.map((a, i) => (
              <li
                key={a.id_archivo ?? `externo-${i}`}
                className="inline-flex h-7 items-center gap-1 rounded-full border bg-surface pr-1 pl-3 text-label text-ink"
              >
                {a.nombre ?? (a.tipo === "pdf" ? "Documento PDF" : "Archivo")}
                {a.id_archivo && (
                  <button
                    type="button"
                    aria-label={`Quitar ${a.nombre ?? "archivo"}`}
                    onClick={() => setArchivoABorrar(a)}
                    className="rounded-full p-1 text-muted hover:bg-surface hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SelectorArchivos
        pendientes={pendientes}
        cupo={cupo}
        validar={problemaArchivo}
        onAgregar={(nuevos) => setPendientes((p) => [...p, ...nuevos])}
        onQuitar={(i) => setPendientes((p) => p.filter((_, j) => j !== i))}
        onProblemas={setProblemas}
        ayuda={`JPG, PNG, WebP o PDF · hasta 10 MB · hasta ${MAX_ARCHIVOS_REGISTRO} por registro · privados, con enlace temporal`}
      />
      {problemas.length > 0 && (
        <Alert tono="error">
          {problemas.map((p) => (
            <span key={p} className="block">
              {p}
            </span>
          ))}
        </Alert>
      )}
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}

      <DialogFooter className="items-center">
        <DialogDescription className="mr-auto text-label">
          El dueño verá este registro en su app, excepto las notas internas.
        </DialogDescription>
        <Button type="button" variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" cargando={ocupado}>
          {editando ? "Guardar cambios" : "Guardar registro"}
        </Button>
      </DialogFooter>
      {tipo === "vacunacion" && !editando && puede("vacunas", "crear") && (
        <p className="-mt-2 flex items-center gap-1.5 text-label text-muted">
          <Syringe className="size-3.5" aria-hidden /> Al guardar podrás registrarla también en el carnet de
          vacunas.
        </p>
      )}

      <ConfirmDialog
        abierto={archivoABorrar !== null}
        onAbiertoChange={(abierto) => !abierto && setArchivoABorrar(null)}
        titulo="¿Quitar este archivo?"
        descripcion={`${archivoABorrar?.nombre ?? "El archivo"} deja de verse en el registro. Queda constancia de quién lo quitó.`}
        confirmar="Quitar archivo"
        peligro
        cargando={eliminar.isPending}
        onConfirmar={() => {
          if (!actual || !archivoABorrar?.id_archivo) return;
          eliminar.mutate(
            { idHistorial: actual.id_historial, idArchivo: archivoABorrar.id_archivo },
            {
              onSuccess: (registro) => {
                setActual(registro);
                setArchivoABorrar(null);
              },
            },
          );
        }}
      />
    </form>
  );
}

/** Tras guardar un registro de vacunación: registrarla también en el carnet (C5, vinculada al registro). */
function OfrecerCarnet({
  registro,
  puedeVacunas,
  onCerrar,
}: {
  registro: RegistroHistorial;
  puedeVacunas: boolean;
  onCerrar: () => void;
}) {
  const abrirVacuna = useUi((s) => s.abrirVacuna);
  return (
    <div className="mt-4 flex flex-col gap-4">
      <Alert tono="exito">Registro de vacunación guardado.</Alert>
      {puedeVacunas ? (
        <p className="text-body text-ink">
          ¿Registrar también la vacuna en el carnet? Queda vinculada a este registro y el dueño recibe los
          recordatorios de la próxima dosis.
        </p>
      ) : (
        <p className="text-body text-muted">Tu rol no registra vacunas en el carnet.</p>
      )}
      <DialogFooter>
        <Button variant="secondary" onClick={onCerrar}>
          {puedeVacunas ? "Ahora no" : "Cerrar"}
        </Button>
        {puedeVacunas && (
          <Button
            onClick={() => {
              // C5 vinculado a este registro, con su fecha y su profesional (lo pinta VacunaHost).
              abrirVacuna({
                idMascota: registro.id_mascota,
                idHistorialMedico: registro.id_historial,
                fechaAplicacion: registro.fecha,
                idEmpleado: registro.empleado?.id_empleado ?? null,
              });
              onCerrar();
            }}
          >
            <Syringe /> Registrar también en el carnet
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
