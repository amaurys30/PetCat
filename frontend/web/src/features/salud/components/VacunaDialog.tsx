import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ApiError } from "@/api/errors";
import type { Vacuna } from "@/api/salud";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SelectorArchivos } from "@/components/common/SelectorArchivos";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { aviso } from "@/components/ui/toaster";
import { useProfesionales } from "@/features/agenda/hooks/useAgenda";
import { nombreCompleto } from "@/features/agenda/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { fechaCorta, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUi, type InicioVacuna } from "@/stores/ui";
import {
  useCrearVacuna,
  useEditarVacuna,
  useEliminarComprobante,
  useHistorial,
  useResumenSalud,
  useSubirComprobante,
  useVacunas,
} from "../hooks/useSalud";
import { problemaArchivo } from "../schemas";
import { textoTipo } from "../textos";
import {
  CAMPO_DE_API_VACUNA,
  cambiosVacunaApi,
  dosisReemplazada,
  nuevaVacunaApi,
  sugerenciasPara,
  vacunaSchema,
  valoresDeVacuna,
  type VacunaValores,
} from "../vacunas";

const SIN_PROFESIONAL = "sin_profesional";
const SIN_REGISTRO = "sin_registro";

/** Lo pinta PanelLayout cuando el store tiene una vacuna por crear o editar. */
export function VacunaHost() {
  const inicio = useUi((s) => s.vacuna);
  const cerrar = useUi((s) => s.cerrarVacuna);
  if (!inicio) return null;
  return (
    <VacunaDialog
      key={inicio.vacuna?.id_vacuna ?? `nueva-${inicio.idHistorialMedico ?? ""}`}
      inicio={inicio}
      onCerrar={cerrar}
    />
  );
}

/**
 * C5 · Registrar una vacuna aplicada por el negocio, o editar una que registró. Primero se
 * guarda la vacuna y después el comprobante (privado): si la subida falla, la vacuna ya existe
 * y se reintenta. Avisa qué dosis anterior pasa a "No aplica" y cuándo recibirá el dueño los
 * recordatorios (y que se reprograman si cambia la próxima dosis).
 */
export function VacunaDialog({ inicio, onCerrar }: { inicio: InicioVacuna; onCerrar: () => void }) {
  const negocio = useNegocioActivo();
  const resumen = useResumenSalud(negocio.id_negocio, inicio.idMascota);
  const vacunas = useVacunas(negocio.id_negocio, inicio.idMascota, true);
  const editando = inicio.vacuna;
  const nombre = resumen.data?.mascota.nombre;
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[620px] overflow-y-auto">
        <DialogTitle>
          {editando ? "Editar vacuna" : "Registrar vacuna"}
          {nombre ? ` · ${nombre}` : ""}
        </DialogTitle>
        {resumen.isPending || vacunas.isPending ? (
          <Skeleton className="mt-4 h-80" />
        ) : resumen.isError ? (
          <Alert tono="error" className="mt-4">
            {resumen.error.message}
          </Alert>
        ) : resumen.data.mascota.fallecido && !editando ? (
          <Alert tono="advertencia" className="mt-4">
            {resumen.data.mascota.nombre} está registrado como fallecido: no se registran vacunas nuevas.
          </Alert>
        ) : (
          <Formulario
            inicio={inicio}
            especie={resumen.data.mascota.especie}
            carnet={vacunas.data ?? []}
            onCerrar={onCerrar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Fase =
  { tipo: "formulario" } | { tipo: "falta_comprobante"; vacuna: Vacuna; archivo: File; error: string };

function Formulario({
  inicio,
  especie,
  carnet,
  onCerrar,
}: {
  inicio: InicioVacuna;
  especie: string;
  carnet: Vacuna[];
  onCerrar: () => void;
}) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const editando = inicio.vacuna;
  const profesionales = useProfesionales(negocio.id_negocio, puede("citas", "ver"));
  const verHistorial = puede("historial_medico", "ver");
  const historial = useHistorial(negocio.id_negocio, inicio.idMascota, {}, verHistorial);
  const crear = useCrearVacuna(negocio.id_negocio);
  const editar = useEditarVacuna(negocio.id_negocio);
  const subir = useSubirComprobante(negocio.id_negocio);
  const quitar = useEliminarComprobante(negocio.id_negocio);
  const [fase, setFase] = useState<Fase>({ tipo: "formulario" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [actual, setActual] = useState<Vacuna | undefined>(editando);
  const [quitando, setQuitando] = useState(false);

  const original: VacunaValores = editando
    ? valoresDeVacuna(editando)
    : {
        nombre: "",
        enfermedad: "",
        fechaAplicacion:
          inicio.fechaAplicacion && inicio.fechaAplicacion <= hoyISO() ? inicio.fechaAplicacion : hoyISO(),
        fechaProxima: "",
        lote: "",
        laboratorio: "",
        dosis: "",
        via: "",
        sitio: "",
        idEmpleado: inicio.idEmpleado ? String(inicio.idEmpleado) : "",
        idHistorial: inicio.idHistorialMedico ? String(inicio.idHistorialMedico) : "",
        notas: "",
      };
  const form = useForm<VacunaValores>({ resolver: zodResolver(vacunaSchema), defaultValues: original });
  const { errors } = form.formState;
  const [nombre, fechaAplicacion, fechaProxima] = useWatch({
    control: form.control,
    name: ["nombre", "fechaAplicacion", "fechaProxima"],
  });

  const reemplazada = dosisReemplazada(carnet, nombre, fechaAplicacion, editando?.id_vacuna);
  const proximaCambio = editando !== undefined && fechaProxima !== original.fechaProxima;
  // Solo los registros de este negocio se pueden vincular (la API lo exige).
  const registros = (historial.data?.pages.flatMap((p) => p.data) ?? []).filter((r) => r.es_propio);
  const ocupado = crear.isPending || editar.isPending || subir.isPending;

  const terminar = () => {
    aviso.exito(editando ? "Vacuna actualizada" : "Vacuna registrada en el carnet");
    onCerrar();
  };

  const subirComprobante = async (vacuna: Vacuna, pendiente: File | null) => {
    if (!pendiente) return terminar();
    try {
      await subir.mutateAsync({ idVacuna: vacuna.id_vacuna, archivo: pendiente });
      terminar();
    } catch (error) {
      setFase({ tipo: "falta_comprobante", vacuna, archivo: pendiente, error: (error as ApiError).message });
    }
  };

  const guardar = form.handleSubmit(async (valores) => {
    setErrorGeneral(null);
    try {
      if (editando) {
        const cambios = cambiosVacunaApi(valores, original);
        const vacuna =
          Object.keys(cambios).length > 0
            ? await editar.mutateAsync({ idVacuna: editando.id_vacuna, cambios })
            : (actual ?? editando);
        await subirComprobante(vacuna, archivo);
      } else {
        const vacuna = await crear.mutateAsync(nuevaVacunaApi(valores, inicio.idMascota));
        await subirComprobante(vacuna, archivo);
      }
    } catch (error) {
      const e = error as ApiError;
      let alguno = false;
      for (const [campo, mensaje] of Object.entries(e.errors ?? {})) {
        const destino = CAMPO_DE_API_VACUNA[campo];
        if (destino) {
          form.setError(destino, { message: mensaje });
          alguno = true;
        }
      }
      if (!alguno) setErrorGeneral(e.message);
    }
  });

  if (fase.tipo === "falta_comprobante") {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <Alert tono="advertencia">
          La vacuna quedó en el carnet, pero no se pudo subir el comprobante ({fase.archivo.name}).{" "}
          {fase.error}
        </Alert>
        <DialogFooter>
          <Button variant="secondary" onClick={terminar}>
            Terminar sin comprobante
          </Button>
          <Button cargando={subir.isPending} onClick={() => void subirComprobante(fase.vacuna, fase.archivo)}>
            Reintentar la subida
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} noValidate className="mt-2 flex flex-col gap-4">
      <div>
        <Field label="Vacuna *" error={errors.nombre?.message}>
          <Input autoComplete="off" {...form.register("nombre")} />
        </Field>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Sugerencias">
          {sugerenciasPara(especie).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => form.setValue("nombre", s, { shouldValidate: true, shouldDirty: true })}
              className={cn(
                "h-7 rounded-full border px-3 text-label font-medium",
                nombre === s
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "bg-surface text-muted hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de aplicación *" error={errors.fechaAplicacion?.message}>
          <Input type="date" max={hoyISO()} {...form.register("fechaAplicacion")} />
        </Field>
        <Field label="Próxima dosis" error={errors.fechaProxima?.message}>
          <Input type="date" {...form.register("fechaProxima")} />
        </Field>
        <Field label="Lote" error={errors.lote?.message}>
          <Input {...form.register("lote")} />
        </Field>
        <Field label="Laboratorio" error={errors.laboratorio?.message}>
          <Input {...form.register("laboratorio")} />
        </Field>
        <Field label="Dosis" error={errors.dosis?.message}>
          <Input placeholder="Refuerzo anual" {...form.register("dosis")} />
        </Field>
        <Field label="Enfermedad que previene" error={errors.enfermedad?.message}>
          <Input {...form.register("enfermedad")} />
        </Field>
        <Field label="Vía de administración" error={errors.via?.message}>
          <Input placeholder="Subcutánea" {...form.register("via")} />
        </Field>
        <Field label="Sitio de aplicación" error={errors.sitio?.message}>
          <Input {...form.register("sitio")} />
        </Field>
        <Field label="Aplicada por" error={errors.idEmpleado?.message}>
          <Controller
            control={form.control}
            name="idEmpleado"
            render={({ field }) => (
              <Select
                value={field.value || SIN_PROFESIONAL}
                onValueChange={(x) => field.onChange(x === SIN_PROFESIONAL ? "" : x)}
              >
                <SelectTrigger aria-label="Aplicada por">
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
                  {field.value &&
                    !(profesionales.data ?? []).some((p) => String(p.id_empleado) === field.value) && (
                      <SelectItem value={field.value}>
                        {editando?.empleado ? nombreCompleto(editando.empleado) : "Profesional del registro"}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          label="Vincular a registro médico"
          error={errors.idHistorial?.message}
          ayuda={!verHistorial ? "Tu rol no ve el historial médico." : undefined}
        >
          <Controller
            control={form.control}
            name="idHistorial"
            render={({ field }) => (
              <Select
                value={field.value || SIN_REGISTRO}
                disabled={!verHistorial || inicio.idHistorialMedico !== undefined}
                onValueChange={(x) => field.onChange(x === SIN_REGISTRO ? "" : x)}
              >
                <SelectTrigger aria-label="Vincular a registro médico">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_REGISTRO}>Sin registro</SelectItem>
                  {registros.map((r) => (
                    <SelectItem key={r.id_historial} value={String(r.id_historial)}>
                      {textoTipo(r.tipo)} · {fechaCorta(r.fecha)}
                    </SelectItem>
                  ))}
                  {field.value && !registros.some((r) => String(r.id_historial) === field.value) && (
                    <SelectItem value={field.value}>
                      Registro del {fechaCorta(fechaAplicacion || hoyISO())}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <Field label="Notas" error={errors.notas?.message}>
        <Textarea rows={2} maxLength={300} {...form.register("notas")} />
      </Field>

      {actual?.comprobante && !archivo && (
        <div className="flex items-center gap-2 text-body">
          <span className="text-muted">Comprobante actual:</span>
          <span className="text-ink">{actual.comprobante.nombre ?? "Comprobante"}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuitando(true)}
            aria-label="Quitar comprobante"
          >
            <Trash2 />
          </Button>
        </div>
      )}
      <SelectorArchivos
        pendientes={archivo ? [archivo] : []}
        cupo={archivo ? 0 : 1}
        multiple={false}
        validar={problemaArchivo}
        onAgregar={([a]) => setArchivo(a ?? null)}
        onQuitar={() => setArchivo(null)}
        onProblemas={setProblemas}
        texto={actual?.comprobante ? "Reemplazar comprobante" : "Subir comprobante (opcional)"}
        ayuda="Foto o PDF del carnet · JPG, PNG, WebP o PDF · hasta 10 MB · privado"
      />
      {problemas.length > 0 && <Alert tono="error">{problemas.join(". ")}</Alert>}

      {reemplazada && (
        <Alert tono="info">
          La dosis anterior de {reemplazada.nombre_vacuna} (aplicada el{" "}
          {fechaCorta(reemplazada.fecha_aplicacion)}) pasará a "No aplica".
        </Alert>
      )}
      {proximaCambio ? (
        <Alert tono="advertencia" className="flex gap-2">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {fechaProxima
              ? `Los recordatorios del dueño se reprogramarán con la nueva fecha: 7 días antes, el día y 7 días después del ${fechaCorta(fechaProxima)}.`
              : "Sin próxima dosis, el dueño ya no recibirá recordatorios de esta vacuna."}
          </span>
        </Alert>
      ) : (
        !editando &&
        fechaProxima && (
          <Alert tono="info" className="flex gap-2">
            <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Si el dueño tiene cuenta, recibirá recordatorios 7 días antes, el día y 7 días después del{" "}
              {fechaCorta(fechaProxima)}.
            </span>
          </Alert>
        )
      )}
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" cargando={ocupado}>
          {editando ? "Guardar cambios" : "Guardar vacuna"}
        </Button>
      </DialogFooter>

      <ConfirmDialog
        abierto={quitando}
        onAbiertoChange={setQuitando}
        titulo="¿Quitar el comprobante?"
        descripcion="La vacuna sigue en el carnet sin su comprobante. Queda constancia de quién lo quitó."
        confirmar="Quitar comprobante"
        peligro
        cargando={quitar.isPending}
        onConfirmar={() =>
          actual &&
          quitar.mutate(actual.id_vacuna, {
            onSuccess: (vacuna) => {
              setActual(vacuna);
              setQuitando(false);
              aviso.exito("Comprobante quitado");
            },
          })
        }
      />
    </form>
  );
}
