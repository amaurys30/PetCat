import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import type { ActualizarEmpleadoBody, CrearEmpleadoBody, Empleado } from "@/api/empleados";
import { subirFotoEmpleado, enviarInvitacion } from "@/api/empleados";
import { ApiError, toApiError } from "@/api/errors";
import type { RolNegocio } from "@/api/roles";
import { Avatar } from "@/components/common/Avatar";
import { SubidorImagen } from "@/components/common/SubidorImagen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { aviso } from "@/components/ui/toaster";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi, sinVacios, soloCambios } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import {
  useActualizarEmpleado,
  useCrearEmpleado,
  useEscalada,
  useFotoEmpleado,
  useReactivarEmpleado,
  useRefrescarEquipo,
  useRoles,
  useServiciosActivos,
} from "../hooks/useEquipo";
import { CAMPOS_MIEMBRO, miembroSchema, type MiembroValores } from "../schemas";
import { MAX_INVITACIONES_24H } from "../textos";

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO_MB = 5;

const valoresDe = (e: Empleado | null): MiembroValores => ({
  nombre: e?.nombre ?? "",
  apellido: e?.apellido ?? "",
  email: e?.email ?? "",
  telefono: e?.telefono ?? "",
  documento: e?.documento ?? "",
  especialidad: e?.especialidad ?? "",
  titulo_profesional: e?.titulo_profesional ?? "",
  registro_profesional: e?.registro_profesional ?? "",
  notas: e?.notas ?? "",
  fecha_vinculacion: e?.fecha_vinculacion ?? "",
  id_rol: e?.rol.id_rol ?? 0,
  servicios: e?.servicios.map((s) => s.id_servicio) ?? [],
});

const mismosIds = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** El 409 de un email que pertenece a un empleado inactivo trae su id en el mensaje. */
const idInactivoDe = (error: ApiError) => {
  const m = /id_empleado (\d+)/.exec(error.message);
  return error.status === 409 && m ? Number(m[1]) : null;
};

/**
 * D3b · Agregar o editar un miembro. Al crear: POST con sus servicios, luego la foto y la
 * invitación; si falla un paso posterior el miembro ya existe y el aviso dice qué falta.
 */
export function MiembroDialog({ empleado, onCerrar }: { empleado: Empleado | null; onCerrar: () => void }) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const escalada = useEscalada();
  const roles = useRoles(negocio.id_negocio);
  const puedeVerServicios = puede("servicios", "ver");
  // La API exige servicios.editar para asignar desde el empleado, y que esté activo.
  const motivoServicios = !puede("servicios", "editar")
    ? "Para asignar servicios necesitas el permiso de editar servicios."
    : empleado && !empleado.activo
      ? "Reactiva al miembro para cambiar sus servicios."
      : null;
  const puedeAsignarServicios = motivoServicios === null;
  const servicios = useServiciosActivos(negocio.id_negocio, puedeVerServicios);
  const crear = useCrearEmpleado();
  const actualizar = useActualizarEmpleado();
  const reactivar = useReactivarEmpleado();
  const refrescar = useRefrescarEquipo();
  const abrirLimitePlan = useUi((s) => s.abrirLimitePlan);

  const iniciales = valoresDe(empleado);
  const form = useForm<MiembroValores>({ resolver: zodResolver(miembroSchema), defaultValues: iniciales });
  const { errors, isSubmitting } = form.formState;
  const [email, idRol] = useWatch({ control: form.control, name: ["email", "id_rol"] });
  const [invitar, setInvitar] = useState(true);
  const [foto, setFoto] = useState<File | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [idInactivo, setIdInactivo] = useState<number | null>(null);

  // Rol por defecto al crear: el primero que se pueda asignar que no sea Administrador.
  useEffect(() => {
    if (empleado || !roles.data || form.getValues("id_rol")) return;
    const asignables = roles.data.filter((r) => !escalada.asignarRol(r.permisos_json));
    const sugerido = asignables.find((r) => r.nombre !== "Administrador") ?? asignables[0];
    if (sugerido) form.setValue("id_rol", sugerido.id_rol);
  }, [roles.data, escalada, empleado, form]);

  const bloqueoRol = empleado ? escalada.cambiarRolDe(empleado.id_empleado) : null;
  const correoCambia = Boolean(empleado?.invitacion?.expiracion) && email.trim() !== (empleado?.email ?? "");
  const nombreCompleto = empleado ? `${empleado.nombre} ${empleado.apellido}` : "";

  const manejarError = (e: unknown) => {
    const error = toApiError(e);
    if (error.limitePlan) {
      onCerrar();
      abrirLimitePlan(error.message);
      return;
    }
    const id = idInactivoDe(error);
    if (id) {
      setIdInactivo(id);
      form.setError("email", { type: "server", message: "Este correo es de un miembro inactivo" });
      return;
    }
    if (!aplicarErroresApi(form.setError, error, CAMPOS_MIEMBRO) || error.status !== 422) {
      setErrorGeneral(error.message);
    }
  };

  const onSubmit = form.handleSubmit(async (valores) => {
    setErrorGeneral(null);
    setIdInactivo(null);
    const { id_rol, servicios: ids, ...textos } = valores;
    try {
      if (!empleado) {
        const body: CrearEmpleadoBody = {
          ...(sinVacios(textos) as Omit<CrearEmpleadoBody, "id_rol" | "nombre" | "apellido">),
          nombre: textos.nombre.trim(),
          apellido: textos.apellido.trim(),
          id_rol,
          ...(puedeAsignarServicios && ids.length > 0 && { servicios: ids }),
        };
        const creado = await crear.mutateAsync(body);
        await completarAlta(creado, { foto, invitar: invitar && Boolean(creado.email) });
      } else {
        const cambios = soloCambios(textos, valoresDe(empleado)) as ActualizarEmpleadoBody;
        if (id_rol !== empleado.rol.id_rol) cambios.id_rol = id_rol;
        if (puedeAsignarServicios && !mismosIds(ids, iniciales.servicios)) cambios.servicios = ids;
        if (Object.keys(cambios).length > 0) {
          await actualizar.mutateAsync({ idEmpleado: empleado.id_empleado, body: cambios });
          await refrescar();
          aviso.exito("Cambios guardados");
        }
        onCerrar();
      }
    } catch (e) {
      manejarError(e);
    }
  });

  /** Foto e invitación después de crear. El miembro ya existe: los fallos se avisan, no se deshacen. */
  const completarAlta = async (creado: Empleado, pasos: { foto: File | null; invitar: boolean }) => {
    const pendientes: string[] = [];
    if (pasos.foto) {
      try {
        await subirFotoEmpleado(creado.id_empleado, pasos.foto);
      } catch (e) {
        pendientes.push(`la foto no se subió (${toApiError(e).message})`);
      }
    }
    let invitado = false;
    if (pasos.invitar) {
      try {
        await enviarInvitacion(creado.id_empleado);
        invitado = true;
      } catch (e) {
        pendientes.push(`la invitación no se envió (${toApiError(e).message})`);
      }
    }
    await refrescar();
    onCerrar();
    const nombre = `${creado.nombre} ${creado.apellido}`;
    if (pendientes.length > 0) {
      aviso.advertencia(`${nombre} quedó en el equipo, pero ${pendientes.join(" y ")}. Reinténtalo desde la lista.`);
    } else {
      aviso.exito(invitado ? `${nombre} quedó en el equipo. Invitación enviada a ${creado.email}.` : `${nombre} quedó en el equipo.`);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !isSubmitting && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto">
        <DialogTitle>{empleado ? `Editar a ${nombreCompleto}` : "Agregar miembro al equipo"}</DialogTitle>
        <DialogDescription className="sr-only">
          Datos del miembro, su rol, los servicios que atiende y su foto.
        </DialogDescription>
        <form onSubmit={onSubmit} noValidate className="mt-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *" error={errors.nombre?.message}>
                <Input {...form.register("nombre")} />
              </Field>
              <Field label="Apellido *" error={errors.apellido?.message}>
                <Input {...form.register("apellido")} />
              </Field>
              <Field
                label="Correo (para la invitación)"
                error={errors.email?.message}
                ayuda={correoCambia ? "Cambiar el correo anula la invitación pendiente." : undefined}
              >
                <Input type="email" autoComplete="off" {...form.register("email")} />
              </Field>
              <Field label="Teléfono" error={errors.telefono?.message}>
                <Input type="tel" {...form.register("telefono")} />
              </Field>
            </div>
            {idInactivo && (
              <Alert tono="advertencia" className="flex items-center justify-between gap-3">
                <span>Ese correo es de un miembro inactivo. Puedes reactivarlo en lugar de crear otro.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  cargando={reactivar.isPending}
                  onClick={() =>
                    reactivar.mutate(idInactivo, {
                      onSuccess: (e) => {
                        aviso.exito(`${e.nombre} ${e.apellido} está activo de nuevo`);
                        onCerrar();
                      },
                    })
                  }
                >
                  Reactivarlo
                </Button>
              </Alert>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Documento" error={errors.documento?.message}>
                <Input placeholder="CC 1.102.345.678" {...form.register("documento")} />
              </Field>
              <Field label="Especialidad" error={errors.especialidad?.message}>
                <Input {...form.register("especialidad")} />
              </Field>
              <Field label="Fecha de vinculación" error={errors.fecha_vinculacion?.message}>
                <Input type="date" title="Vacía: hoy" {...form.register("fecha_vinculacion")} />
              </Field>
              <Field label="Título profesional" error={errors.titulo_profesional?.message}>
                <Input {...form.register("titulo_profesional")} />
              </Field>
              <Field label="Registro profesional" error={errors.registro_profesional?.message}>
                <Input {...form.register("registro_profesional")} />
              </Field>
              <Field label="Notas internas" error={errors.notas?.message}>
                <Input placeholder="Solo las ve el equipo" {...form.register("notas")} />
              </Field>
            </div>

            <SelectorRol
              roles={roles.data}
              cargando={roles.isPending}
              error={roles.error?.message ?? errors.id_rol?.message}
              valor={idRol}
              onChange={(id) => form.setValue("id_rol", id, { shouldDirty: true, shouldValidate: true })}
              bloqueo={bloqueoRol}
              puedeCrearRol={puede("roles", "crear")}
            />

            {puedeVerServicios && (
              <Controller
                control={form.control}
                name="servicios"
                render={({ field }) => (
                  <SelectorServicios
                    servicios={servicios.data}
                    cargando={servicios.isPending}
                    seleccionados={field.value}
                    onChange={field.onChange}
                    motivo={motivoServicios}
                    error={errors.servicios?.message}
                  />
                )}
              />
            )}

            <div className="rounded-card bg-surface p-4">
              {empleado ? (
                <FotoMiembro empleado={empleado} />
              ) : (
                <FotoPendiente archivo={foto} onElegir={setFoto} nombre={form.getValues("nombre") || "?"} />
              )}
            </div>

            {!empleado && (
              <div className="flex items-start gap-3">
                <Switch
                  id="miembro-invitar"
                  checked={invitar && email.trim() !== ""}
                  disabled={email.trim() === ""}
                  onCheckedChange={setInvitar}
                />
                <div>
                  <Label htmlFor="miembro-invitar" className="text-body font-semibold text-ink">
                    Enviar invitación por correo al guardar
                  </Label>
                  <p className="text-label text-muted">
                    {email.trim() === ""
                      ? "Agrega un correo para poder invitarlo."
                      : `Vence en 72 h. Podrás reenviarla (máximo ${MAX_INVITACIONES_24H} correos en 24 h). Si ya tiene cuenta en PetCat, solo confirmará su contraseña.`}
                  </p>
                </div>
              </div>
            )}

            {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" cargando={isSubmitting}>
                {empleado
                  ? "Guardar cambios"
                  : invitar && email.trim() !== ""
                    ? "Guardar y enviar invitación"
                    : "Guardar"}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectorRol({
  roles,
  cargando,
  error,
  valor,
  onChange,
  bloqueo,
  puedeCrearRol,
}: {
  roles: RolNegocio[] | undefined;
  cargando: boolean;
  error?: string;
  valor: number;
  onChange: (idRol: number) => void;
  bloqueo: string | null;
  puedeCrearRol: boolean;
}) {
  const escalada = useEscalada();
  return (
    <div>
      <p id="miembro-rol" className="mb-1.5 text-label font-medium text-muted">
        Rol *
      </p>
      {cargando ? (
        <Skeleton className="h-16" />
      ) : (
        <div role="radiogroup" aria-labelledby="miembro-rol" className="grid grid-cols-4 gap-2">
          {roles?.map((r) => {
            const motivo = bloqueo ?? (r.id_rol === valor ? null : escalada.asignarRol(r.permisos_json));
            const elegido = r.id_rol === valor;
            return (
              <button
                key={r.id_rol}
                type="button"
                role="radio"
                aria-checked={elegido}
                aria-disabled={Boolean(motivo) || undefined}
                title={motivo ?? undefined}
                onClick={() => !motivo && onChange(r.id_rol)}
                className={cn(
                  "flex flex-col rounded-control border p-2.5 text-left transition-colors",
                  elegido ? "border-primary bg-selected" : "bg-white hover:bg-surface",
                  motivo && !elegido && "cursor-not-allowed opacity-50 hover:bg-white",
                )}
              >
                <span className="flex items-center gap-1.5 text-body font-semibold text-ink">
                  <span
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 rounded-full border",
                      elegido ? "border-4 border-primary" : "border-subtle",
                    )}
                  />
                  <span className="truncate">{r.nombre}</span>
                  {!r.es_sistema && <Badge tono="info">Propio</Badge>}
                </span>
                <span className="mt-0.5 line-clamp-2 text-label text-muted">
                  {motivo && !elegido ? motivo : (r.descripcion ?? "")}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className={cn("text-label", error ? "text-danger" : "text-muted")}>
          {error ?? bloqueo ?? (escalada.esEmpleado ? "Solo puedes asignar roles con permisos que tu rol tenga." : "")}
        </p>
        {puedeCrearRol && (
          <Link to="../roles?rol=nuevo" className="shrink-0 text-label font-semibold text-primary hover:underline">
            + Crear rol propio
          </Link>
        )}
      </div>
    </div>
  );
}

function SelectorServicios({
  servicios,
  cargando,
  seleccionados,
  onChange,
  motivo,
  error,
}: {
  servicios: { id_servicio: number; nombre: string }[] | undefined;
  cargando: boolean;
  seleccionados: number[];
  onChange: (ids: number[]) => void;
  /** Por qué no se pueden cambiar (null si se puede). */
  motivo: string | null;
  error?: string;
}) {
  const alternar = (id: number) =>
    onChange(seleccionados.includes(id) ? seleccionados.filter((s) => s !== id) : [...seleccionados, id]);
  return (
    <div>
      <p id="miembro-servicios" className="mb-1.5 text-label font-medium text-muted">
        Servicios que atiende
      </p>
      {cargando ? (
        <Skeleton className="h-8" />
      ) : servicios?.length === 0 ? (
        <p className="text-body text-muted">Todavía no hay servicios activos. Créalos en Servicios.</p>
      ) : (
        <div role="group" aria-labelledby="miembro-servicios" className="flex flex-wrap gap-2">
          {servicios?.map((s) => {
            const activo = seleccionados.includes(s.id_servicio);
            return (
              <button
                key={s.id_servicio}
                type="button"
                aria-pressed={activo}
                disabled={motivo !== null}
                onClick={() => alternar(s.id_servicio)}
                className={cn(
                  "h-8 rounded-control border px-3 text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  activo ? "border-primary bg-primary text-white" : "bg-white text-ink hover:bg-surface",
                )}
              >
                {s.nombre}
              </button>
            );
          })}
        </div>
      )}
      {(error || motivo) && (
        <p className={cn("mt-1.5 text-label", error ? "text-danger" : "text-muted")}>{error ?? motivo}</p>
      )}
    </div>
  );
}

function FotoMiembro({ empleado }: { empleado: Empleado }) {
  const foto = useFotoEmpleado(empleado.id_empleado);
  const escalada = useEscalada();
  const puede = usePuede();
  const puedeCambiar = puede("empleados", "editar") || escalada.esYo(empleado.id_empleado);
  return (
    <SubidorImagen
      etiqueta="Foto"
      articulo="la"
      ayuda="JPG, PNG o WebP · hasta 5 MB. También puede subirla el miembro."
      maxMb={MAX_FOTO_MB}
      forma="circulo"
      nombre={`${empleado.nombre} ${empleado.apellido}`}
      urlActual={foto.subir.data?.foto_url ?? (foto.quitar.isSuccess ? null : empleado.foto_url)}
      disabled={!puedeCambiar}
      onSubir={(archivo, onProgreso) => foto.subir.mutateAsync({ archivo, onProgreso })}
      onQuitar={() => foto.quitar.mutateAsync()}
    />
  );
}

/** Al crear, la foto se elige ahora y se sube después de crear al miembro. */
function FotoPendiente({
  archivo,
  onElegir,
  nombre,
}: {
  archivo: File | null;
  onElegir: (archivo: File | null) => void;
  nombre: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previa = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  return (
    <div className="flex items-center gap-4">
      <input
        ref={input}
        type="file"
        accept={TIPOS_FOTO.join(",")}
        className="hidden"
        aria-label="Archivo de foto"
        onChange={(e) => {
          const elegido = e.target.files?.[0];
          e.target.value = "";
          setError(null);
          if (!elegido) return;
          if (!TIPOS_FOTO.includes(elegido.type)) return setError("Usa una imagen JPG, PNG o WebP.");
          if (elegido.size > MAX_FOTO_MB * 1024 * 1024) return setError(`La imagen pesa más de ${MAX_FOTO_MB} MB.`);
          onElegir(elegido);
        }}
      />
      <Avatar nombre={nombre} fotoUrl={previa} tamano="lg" tono="suave" />
      <div className="flex-1">
        <p className="text-body font-semibold text-ink">Foto (opcional)</p>
        <p className="text-label text-muted">Se sube después de crear al miembro; también puede subirla él mismo.</p>
        {error && (
          <p role="alert" className="mt-1 text-label text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {archivo && (
          <Button type="button" size="sm" variant="secondary" onClick={() => onElegir(null)}>
            Quitar
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
          {archivo ? "Cambiar foto" : "Subir foto"}
        </Button>
      </div>
    </div>
  );
}
