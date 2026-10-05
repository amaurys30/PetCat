import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { toApiError } from "@/api/errors";
import type { Servicio } from "@/api/servicios";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NoEncontrado, SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { aviso } from "@/components/ui/toaster";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { fechaCorta, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CampoDinero } from "../components/CampoDinero";
import { useEstadoServicio, type EstadoRenombrar } from "../components/EstadoServicio";
import { IndicacionesPrevias } from "../components/IndicacionesPrevias";
import { ProfesionalesServicio } from "../components/ProfesionalesServicio";
import { useCategoriasServicio, useGuardarServicio, useServicio } from "../hooks/useServicios";
import {
  CAMPOS_SERVICIO,
  cambiosDe,
  cuerpoDe,
  numero,
  servicioSchema,
  valoresDe,
  type ServicioValores,
} from "../schemas";
import { DIAS, ESPECIES, estadoOferta, textoMinutos, textoPrecio, TIPOS_PRECIO } from "../textos";

/** D2 · Nuevo servicio (`/servicios/nuevo`) o editar uno (`/servicios/:idServicio`). */
export function ServicioFormPage() {
  const { idServicio } = useParams();
  const puede = usePuede();
  const id = idServicio === undefined ? null : Number(idServicio);
  const valido = id === null || (Number.isInteger(id) && id > 0);
  const servicio = useServicio(id ?? 0, id !== null && valido && puede("servicios", "ver"));

  const volver = (
    <Button asChild variant="secondary">
      <Link to="..">Volver a servicios</Link>
    </Button>
  );
  if (!puede("servicios", id === null ? "crear" : "ver")) {
    return (
      <Card>
        <SinPermiso acciones={volver} />
      </Card>
    );
  }
  if (!valido) {
    return (
      <Card>
        <NoEncontrado acciones={volver} />
      </Card>
    );
  }
  if (id !== null) {
    if (servicio.isPending) return <Skeleton className="h-[640px] rounded-card" />;
    if (servicio.isError) {
      return (
        <Card>
          <ErrorConsulta error={servicio.error} reintentar={() => void servicio.refetch()} />
        </Card>
      );
    }
  }
  // La key reinicia el formulario si cambia el servicio.
  return <FormularioServicio key={id ?? "nuevo"} servicio={servicio.data ?? null} />;
}

function FormularioServicio({ servicio }: { servicio: Servicio | null }) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const navigate = useNavigate();
  const location = useLocation();
  const categorias = useCategoriasServicio();
  const guardar = useGuardarServicio();
  const estado = useEstadoServicio(() => ".");

  const editable = puede("servicios", servicio ? "editar" : "crear");
  // Los profesionales se asignan si se puede listar el equipo; sin eso, no se envían.
  const conEmpleados = editable && puede("empleados", "ver");
  const renombrar = (location.state as EstadoRenombrar | null)?.renombrar === true;

  const iniciales = useMemo(() => valoresDe(servicio), [servicio]);
  const hoy = hoyISO();
  const resolver = useMemo(
    () =>
      zodResolver(
        servicioSchema({ hoy, inicial: servicio ? iniciales : null }),
      ) as unknown as Resolver<ServicioValores>,
    [hoy, servicio, iniciales],
  );
  const form = useForm<ServicioValores>({ resolver, defaultValues: iniciales });
  const { errors, isSubmitting, isDirty } = form.formState;
  const v = useWatch({ control: form.control }) as ServicioValores;
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmarSinProfesionales, setConfirmarSinProfesionales] = useState<ServicioValores | null>(null);

  // Se consulta al salir: después de guardar, se navega sin preguntar.
  const sucio = useRef(false);
  const haySinGuardar = useCallback(() => sucio.current, []);
  useEffect(() => {
    sucio.current = isDirty;
  }, [isDirty]);

  // "Asignar →" del catálogo llega con #profesionales; "Cambiar nombre" con el estado renombrar.
  useEffect(() => {
    if (location.hash === "#profesionales") {
      const seccion = document.getElementById("profesionales");
      seccion?.scrollIntoView?.({ block: "center" });
      seccion?.focus({ preventScroll: true });
    } else if (renombrar) {
      form.setFocus("nombre");
    }
  }, [location.hash, renombrar, form]);

  const enviar = async (valores: ServicioValores) => {
    setErrorGeneral(null);
    const cuerpo = cuerpoDe(valores, { conEmpleados });
    try {
      if (!servicio) {
        const creado = await guardar.mutateAsync({ nuevo: cuerpo });
        sucio.current = false;
        aviso.exito(`«${creado.nombre}» quedó creado`);
        navigate("..");
        return;
      }
      const cambios = cambiosDe(cuerpo, cuerpoDe(iniciales, { conEmpleados }));
      if (Object.keys(cambios).length > 0) {
        const actualizado = await guardar.mutateAsync({ idServicio: servicio.id_servicio, cambios });
        aviso.exito("Cambios guardados");
        if (!actualizado.activo) {
          // Inactivo: se queda para poder reactivarlo (por ejemplo, después de cambiarle el nombre).
          form.reset(valoresDe(actualizado));
          return;
        }
      }
      sucio.current = false;
      navigate("..");
    } catch (e) {
      const error = toApiError(e);
      if (error.status === 409 && error.errors.nombre) {
        form.setError("nombre", { type: "server", message: "Ya hay otro servicio activo con este nombre" });
        form.setFocus("nombre");
        return;
      }
      if (!aplicarErroresApi(form.setError, error, CAMPOS_SERVICIO) || error.status !== 422) {
        setErrorGeneral(error.message);
      }
    }
  };

  // Antes de guardar un servicio que no se podrá reservar (y antes sí se podía, o es nuevo), se confirma.
  const onSubmit = (e: React.FormEvent) =>
    void form.handleSubmit(async (valores) => {
      const quedaSinProfesionales = valores.requiere_cita && valores.empleados.length === 0 && conEmpleados;
      if (quedaSinProfesionales && (!servicio || servicio.reservable)) {
        setConfirmarSinProfesionales(valores);
        return;
      }
      await enviar(valores);
    })(e);

  const tipoPrecio = v.tipo_precio;
  const base = numero(v.precio_base ?? "");
  const oferta = servicio ? estadoOferta(servicio, hoy) : null;
  const ofertaVencidaSinTocar =
    oferta === "vencida" && v.en_oferta && v.fecha_fin_oferta === iniciales.fecha_fin_oferta;

  const alternarEspecie = (especie: ServicioValores["tipo_mascota"][number]) => {
    const actual = form.getValues("tipo_mascota");
    const siguiente =
      especie === "todos"
        ? (["todos"] as ServicioValores["tipo_mascota"])
        : actual.includes(especie)
          ? actual.filter((e) => e !== especie)
          : [...actual.filter((e) => e !== "todos"), especie];
    form.setValue("tipo_mascota", siguiente, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  };

  const alternarDia = (dia: ServicioValores["dias_disponible"][number]) => {
    const actual = form.getValues("dias_disponible");
    form.setValue(
      "dias_disponible",
      actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia],
      { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
    );
  };

  const cambiarOferta = (activa: boolean) => {
    form.setValue("en_oferta", activa, { shouldDirty: true });
    // La fecha de inicio se propone con hoy.
    if (activa && !form.getValues("fecha_inicio_oferta")) {
      form.setValue("fecha_inicio_oferta", hoy, { shouldDirty: true });
    }
    if (form.formState.isSubmitted) void form.trigger();
  };

  const titulo = servicio ? servicio.nombre : "Nuevo servicio";

  return (
    <form onSubmit={onSubmit} noValidate>
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
      <div className="mb-5">
        <h2 className="text-title font-bold text-ink">{titulo}</h2>
        <p className="mt-1 text-body text-muted">
          <Link to=".." className="hover:underline">
            Servicios
          </Link>{" "}
          / {servicio ? (editable ? "Editar servicio" : "Detalle del servicio") : "Nuevo servicio"}
        </p>
      </div>

      {servicio && !servicio.activo && (
        <Alert tono="advertencia" className="mb-4 flex items-center justify-between gap-4">
          <span>
            Este servicio está inactivo: no aparece en la app ni se puede agendar.
            {renombrar && " Cámbiale el nombre, guarda y después reactívalo."}
            {isDirty && puede("servicios", "editar") && " Guarda los cambios antes de reactivarlo."}
          </span>
          {puede("servicios", "editar") && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isDirty}
              cargando={estado.reactivando}
              onClick={() => estado.reactivar(servicio)}
            >
              Reactivar
            </Button>
          )}
        </Alert>
      )}
      {!editable && (
        <Alert tono="info" className="mb-4">
          Solo puedes ver este servicio: tu rol no incluye editar servicios.
        </Alert>
      )}

      <fieldset
        disabled={!editable || isSubmitting}
        className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-4"
      >
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="mb-4 text-card font-semibold text-ink">Información</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *" error={errors.nombre?.message}>
                <Input maxLength={150} {...form.register("nombre")} />
              </Field>
              <Controller
                control={form.control}
                name="id_categoria"
                render={({ field }) => (
                  // El Field envuelve el disparador (el Select de Radix no pinta un elemento).
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(valor) => field.onChange(Number(valor))}
                    disabled={!editable || isSubmitting}
                  >
                    <Field
                      label="Categoría *"
                      error={errors.id_categoria?.message ?? categorias.error?.message}
                    >
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue
                          placeholder={categorias.isPending ? "Cargando…" : "Elige una categoría"}
                        />
                      </SelectTrigger>
                    </Field>
                    <SelectContent>
                      {categorias.data?.map((c) => (
                        <SelectItem key={c.id_categoria} value={String(c.id_categoria)}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Field label="Descripción" error={errors.descripcion?.message} className="col-span-2">
                <Input maxLength={2000} {...form.register("descripcion")} />
              </Field>
            </div>

            <div className="mt-4">
              <p id="servicio-especies" className="mb-1.5 text-label font-medium text-muted">
                Especies que atiende *
              </p>
              <div role="group" aria-labelledby="servicio-especies" className="flex flex-wrap gap-2">
                <Pastilla activa={v.tipo_mascota?.includes("todos")} onClick={() => alternarEspecie("todos")}>
                  Todas
                </Pastilla>
                {ESPECIES.map((e) => (
                  <Pastilla
                    key={e.valor}
                    activa={v.tipo_mascota?.includes(e.valor)}
                    onClick={() => alternarEspecie(e.valor)}
                  >
                    {e.texto}
                  </Pastilla>
                ))}
              </div>
              <p className={cn("mt-1.5 text-label", errors.tipo_mascota ? "text-danger" : "text-muted")}>
                {errors.tipo_mascota?.message ?? "«Todas» no se combina con otras especies."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Peso mínimo (kg)" error={errors.peso_min_kg?.message}>
                <Input inputMode="decimal" placeholder="Opcional" {...form.register("peso_min_kg")} />
              </Field>
              <Field label="Peso máximo (kg)" error={errors.peso_max_kg?.message}>
                <Input inputMode="decimal" placeholder="Opcional" {...form.register("peso_max_kg")} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-card font-semibold text-ink">Precio y duración</h3>
            <p className="mt-0.5 mb-4 text-label text-muted">
              El cliente ve el precio actual; si hay oferta vigente, ve el de oferta.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="precio_base"
                render={({ field }) => (
                  <Field label="Precio base (COP) *" error={errors.precio_base?.message}>
                    <CampoDinero value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="precio_maximo"
                render={({ field }) => (
                  <Field label="Precio máximo" error={errors.precio_maximo?.message}>
                    <CampoDinero
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Opcional"
                    />
                  </Field>
                )}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p id="servicio-tipo-precio" className="text-label font-medium text-muted">
                Tipo de precio
              </p>
              <div role="radiogroup" aria-labelledby="servicio-tipo-precio" className="flex gap-1.5">
                {TIPOS_PRECIO.map((t) => (
                  <Pastilla
                    key={t.valor}
                    rol="radio"
                    activa={tipoPrecio === t.valor}
                    onClick={() => form.setValue("tipo_precio", t.valor, { shouldDirty: true })}
                  >
                    {t.texto}
                  </Pastilla>
                ))}
              </div>
              {base !== null && !Number.isNaN(base) && (
                <p className="text-label text-muted">
                  En la app se verá:{" "}
                  <span className="font-semibold text-ink">
                    {textoPrecio({
                      precio: base,
                      precio_maximo: numero(v.precio_maximo ?? ""),
                      tipo_precio: tipoPrecio,
                    })}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field
                label="Duración (min) *"
                error={errors.duracion_minutos?.message}
                ayuda={duracionAyuda(v.duracion_minutos)}
              >
                <Input type="number" min={5} max={1440} step={5} {...form.register("duracion_minutos")} />
              </Field>
              <Field
                label="Margen después (min)"
                error={errors.margen_minutos?.message}
                ayuda="Ocupa la agenda del profesional después de la cita; la cita no se alarga."
              >
                <Input type="number" min={0} max={240} step={5} {...form.register("margen_minutos")} />
              </Field>
              <Field label="Máx. citas por día" error={errors.max_citas_dia?.message} ayuda="Por sede y día.">
                <Input
                  type="number"
                  min={1}
                  max={255}
                  placeholder="Sin límite"
                  {...form.register("max_citas_dia")}
                />
              </Field>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <Switch
                id="servicio-oferta"
                checked={v.en_oferta}
                onCheckedChange={cambiarOferta}
                disabled={!editable || isSubmitting}
              />
              <div>
                <Label htmlFor="servicio-oferta" className="text-body font-semibold text-ink">
                  En oferta
                </Label>
                <p className="text-label text-muted">
                  Precio de oferta menor al base, con fechas de inicio y fin.
                </p>
              </div>
            </div>
            {v.en_oferta && (
              <>
                {ofertaVencidaSinTocar && (
                  <Alert tono="advertencia" className="mt-3 flex items-center justify-between gap-3">
                    <span>
                      La oferta venció el {fechaCorta(iniciales.fecha_fin_oferta)}. Puedes guardar lo demás;
                      para renovarla, cambia las fechas.
                    </span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => cambiarOferta(false)}>
                      Quitar oferta
                    </Button>
                  </Alert>
                )}
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <Controller
                    control={form.control}
                    name="precio_oferta"
                    render={({ field }) => (
                      <Field label="Precio de oferta *" error={errors.precio_oferta?.message}>
                        <CampoDinero value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      </Field>
                    )}
                  />
                  <Field label="Desde *" error={errors.fecha_inicio_oferta?.message}>
                    <Input type="date" {...form.register("fecha_inicio_oferta")} />
                  </Field>
                  <Field label="Hasta *" error={errors.fecha_fin_oferta?.message}>
                    <Input type="date" min={hoy} {...form.register("fecha_fin_oferta")} />
                  </Field>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="mb-3 text-card font-semibold text-ink">Disponibilidad</h3>
            <Interruptor
              id="servicio-requiere-cita"
              titulo="Requiere cita"
              ayuda="Si lo desactivas, se atiende por orden de llegada."
              checked={v.requiere_cita}
              disabled={!editable || isSubmitting}
              onChange={(valor) => form.setValue("requiere_cita", valor, { shouldDirty: true })}
            />
            <Interruptor
              id="servicio-visible"
              titulo="Visible en la app"
              ayuda="Oculto, no aparece en la búsqueda de la app."
              checked={v.visible_app}
              disabled={!editable || isSubmitting}
              onChange={(valor) => form.setValue("visible_app", valor, { shouldDirty: true })}
            />
            <p id="servicio-dias" className="mt-4 mb-1.5 text-label font-medium text-muted">
              Días en que se ofrece
            </p>
            <div role="group" aria-labelledby="servicio-dias" className="flex gap-1.5">
              {DIAS.map((d) => (
                <Pastilla
                  key={d.valor}
                  cuadrada
                  etiqueta={d.nombre}
                  activa={v.dias_disponible?.includes(d.valor)}
                  onClick={() => alternarDia(d.valor)}
                >
                  {d.corto}
                </Pastilla>
              ))}
            </div>
            <p className={cn("mt-1.5 text-label", errors.dias_disponible ? "text-danger" : "text-muted")}>
              {errors.dias_disponible?.message ??
                (v.dias_disponible?.length === DIAS.length
                  ? "Todos los días que abra la sede."
                  : "Solo esos días, dentro del horario de la sede.")}
            </p>
          </Card>

          <Controller
            control={form.control}
            name="empleados"
            render={({ field }) => (
              <ProfesionalesServicio
                servicio={servicio}
                valor={field.value}
                onChange={(ids) => field.onChange(ids)}
                editable={conEmpleados && !isSubmitting}
                requiereCita={v.requiere_cita}
                error={errors.empleados?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="indicaciones_previas"
            render={({ field }) => (
              <IndicacionesPrevias
                valor={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.indicaciones_previas?.message}
                disabled={!editable || isSubmitting}
                servicio={v.nombre ?? ""}
                negocio={negocio.nombre}
              />
            )}
          />
        </div>
      </fieldset>

      {errorGeneral && (
        <Alert tono="error" className="mt-4">
          {errorGeneral}
        </Alert>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button asChild variant="secondary">
          <Link to="..">{editable ? "Cancelar" : "Volver"}</Link>
        </Button>
        {editable && (
          <Button type="submit" cargando={isSubmitting}>
            {servicio ? "Guardar cambios" : "Guardar servicio"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        abierto={confirmarSinProfesionales !== null}
        onAbiertoChange={(abierto) => !abierto && setConfirmarSinProfesionales(null)}
        titulo="¿Guardar sin profesionales?"
        descripcion={
          v.visible_app
            ? "Aparecerá en la app, pero nadie podrá reservarlo hasta que le asignes al menos un profesional."
            : "Nadie podrá reservarlo hasta que le asignes al menos un profesional."
        }
        confirmar="Guardar igual"
        cancelar="Asignar profesionales"
        cargando={isSubmitting}
        onConfirmar={() => {
          const valores = confirmarSinProfesionales;
          setConfirmarSinProfesionales(null);
          if (valores) void form.handleSubmit(() => enviar(valores))();
        }}
      />
      {estado.dialogos}
    </form>
  );
}

const duracionAyuda = (valor: string | undefined) => {
  const n = numero(valor ?? "");
  return n !== null && Number.isInteger(n) && n >= 120 ? textoMinutos(n) : "En múltiplos de 5.";
};

function Interruptor({
  id,
  titulo,
  ayuda,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  titulo: string;
  ayuda: string;
  checked: boolean;
  disabled: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <div>
        <Label htmlFor={id} className="text-body font-semibold text-ink">
          {titulo}
        </Label>
        <p className="text-label text-muted">{ayuda}</p>
      </div>
    </div>
  );
}

/** Botón que se activa y desactiva (especies, tipo de precio, días). */
function Pastilla({
  activa = false,
  onClick,
  children,
  rol,
  cuadrada = false,
  etiqueta,
}: {
  activa?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  rol?: "radio";
  cuadrada?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      role={rol}
      aria-checked={rol === "radio" ? activa : undefined}
      aria-pressed={rol === "radio" ? undefined : activa}
      aria-label={etiqueta}
      onClick={onClick}
      className={cn(
        "h-8 rounded-control border text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        cuadrada ? "w-8" : "px-3",
        activa ? "border-primary bg-primary text-white" : "bg-white text-ink hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}
