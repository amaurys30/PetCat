import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { toApiError } from "@/api/errors";
import type { RolNegocio } from "@/api/roles";
import type { Permisos } from "@/api/types";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Cargando, SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { AccionesEquipo } from "../EquipoLayout";
import {
  useCatalogoPermisos,
  useEliminarRol,
  useEscalada,
  useGuardarRol,
  useRoles,
} from "../hooks/useEquipo";
import { rolSchema, type RolValores } from "../schemas";
import { ACCIONES_EN_COLUMNAS, COLUMNAS_MATRIZ, nombreAccion, nombreModulo, textoMiembros } from "../textos";

/** D4 · Roles y permisos. El rol elegido queda en `?rol=` (o `?rol=nuevo`). */
export function RolesPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const roles = useRoles(negocio.id_negocio, puede("roles", "ver"));
  const catalogo = useCatalogoPermisos();
  const [params, setParams] = useSearchParams();
  const sinGuardar = useRef(false);
  const haySinGuardar = useCallback(() => sinGuardar.current, []);
  const marcar = useCallback((sucio: boolean) => {
    sinGuardar.current = sucio;
  }, []);

  if (!puede("roles", "ver")) {
    return (
      <Card>
        <SinPermiso />
      </Card>
    );
  }
  if (roles.isError || catalogo.isError) {
    const error = (roles.error ?? catalogo.error)!;
    return (
      <Card>
        <ErrorConsulta
          error={error}
          reintentar={() => void Promise.all([roles.refetch(), catalogo.refetch()])}
        />
      </Card>
    );
  }
  if (!roles.data || !catalogo.data) {
    return (
      <Card>
        <Cargando lineas={6} />
      </Card>
    );
  }

  const nuevo = puede("roles", "crear") && params.get("rol") === "nuevo";
  const rol = nuevo
    ? null
    : (roles.data.find((r) => String(r.id_rol) === params.get("rol")) ?? roles.data[0]!);
  const elegir = (valor: string) => setParams({ rol: valor });

  return (
    <>
      <AccionesEquipo>
        {puede("roles", "crear") && (
          <Button onClick={() => elegir("nuevo")}>
            <Plus /> Nuevo rol
          </Button>
        )}
      </AccionesEquipo>
      <div className="grid grid-cols-[300px_1fr] items-start gap-5">
        <Card className="flex flex-col gap-2 p-3">
          {roles.data.map((r) => {
            const activo = !nuevo && r.id_rol === rol?.id_rol;
            return (
              <button
                key={r.id_rol}
                type="button"
                aria-current={activo ? "true" : undefined}
                onClick={() => elegir(String(r.id_rol))}
                className={cn(
                  "rounded-card border p-3 text-left transition-colors",
                  activo ? "border-primary bg-selected" : "border-transparent hover:bg-surface",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-card font-semibold text-ink">{r.nombre}</span>
                  {r.es_sistema ? (
                    <Badge tono="neutral">
                      <Lock className="size-3" aria-hidden /> Sistema
                    </Badge>
                  ) : (
                    <Badge tono="info">Propio</Badge>
                  )}
                </span>
                {r.descripcion && <span className="mt-0.5 block text-label text-muted">{r.descripcion}</span>}
                <span className="mt-1 block text-label text-subtle">
                  {textoMiembros(r.empleados_activos, r.empleados_inactivos)}
                </span>
              </button>
            );
          })}
        </Card>
        <EditorRol
          key={rol?.id_rol ?? "nuevo"}
          rol={rol}
          catalogo={catalogo.data}
          onSucio={marcar}
          onCreado={(id) => elegir(String(id))}
          onEliminado={() => setParams({})}
        />
      </div>
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
    </>
  );
}

const ordenar = (permisos: Permisos): Permisos =>
  Object.fromEntries(
    Object.entries(permisos)
      .filter(([, acciones]) => acciones && acciones.length > 0)
      .map(([m, acciones]) => [m, [...(acciones ?? [])].sort()])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
const mismosPermisos = (a: Permisos, b: Permisos) =>
  JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));

function EditorRol({
  rol,
  catalogo,
  onSucio,
  onCreado,
  onEliminado,
}: {
  rol: RolNegocio | null;
  catalogo: Permisos;
  onSucio: (sucio: boolean) => void;
  onCreado: (idRol: number) => void;
  onEliminado: () => void;
}) {
  const puede = usePuede();
  const escalada = useEscalada();
  const guardar = useGuardarRol();
  const eliminar = useEliminarRol();
  const [permisos, setPermisos] = useState<Permisos>(rol?.permisos_json ?? {});
  const [error, setError] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const iniciales: RolValores = { nombre: rol?.nombre ?? "", descripcion: rol?.descripcion ?? "" };
  const form = useForm<RolValores>({ resolver: zodResolver(rolSchema), defaultValues: iniciales });
  const { errors, isDirty, isSubmitting } = form.formState;

  // Por qué no se puede editar: del sistema, sin permiso o por las reglas de escalada.
  const bloqueo = rol
    ? rol.es_sistema
      ? "Los roles del sistema no se pueden editar"
      : !puede("roles", "editar")
        ? "Tu rol no permite editar roles"
        : escalada.modificarRol(rol)
    : null;
  const editable = bloqueo === null;
  const sucio = editable && (isDirty || !mismosPermisos(permisos, rol?.permisos_json ?? {}));
  const total = rol ? rol.empleados_activos + rol.empleados_inactivos : 0;
  const motivoEliminar =
    total > 0
      ? `Tiene ${textoMiembros(rol!.empleados_activos, rol!.empleados_inactivos)}: cámbiales el rol antes de eliminarlo${rol!.empleados_inactivos > 0 ? ", también a los inactivos" : ""}.`
      : null;

  useEffect(() => {
    onSucio(sucio);
  }, [sucio, onSucio]);

  const alternar = (modulo: string, accion: string) =>
    setPermisos((actual) => {
      const acciones = actual[modulo] ?? [];
      const nuevas = acciones.includes(accion) ? acciones.filter((a) => a !== accion) : [...acciones, accion];
      return { ...actual, [modulo]: nuevas };
    });

  const onSubmit = form.handleSubmit(async (valores) => {
    setError(null);
    const permisos_json = ordenar(permisos);
    try {
      if (rol) {
        const cambios = {
          ...(valores.nombre.trim() !== rol.nombre && { nombre: valores.nombre.trim() }),
          ...(valores.descripcion.trim() !== (rol.descripcion ?? "") && {
            descripcion: valores.descripcion.trim() || null,
          }),
          ...(!mismosPermisos(permisos, rol.permisos_json) && { permisos_json }),
        };
        await guardar.mutateAsync({ idRol: rol.id_rol, cambios });
        form.reset(valores);
        onSucio(false);
      } else {
        const creado = await guardar.mutateAsync({
          nuevo: {
            nombre: valores.nombre.trim(),
            ...(valores.descripcion.trim() && { descripcion: valores.descripcion.trim() }),
            permisos_json,
          },
        });
        onSucio(false);
        onCreado(creado.id_rol);
      }
    } catch (e) {
      const apiError = toApiError(e);
      if (!aplicarErroresApi(form.setError, apiError, ["nombre", "descripcion"])) {
        if (apiError.status === 409 && apiError.errors.nombre) {
          form.setError("nombre", { type: "server", message: apiError.message });
        } else setError(apiError.message);
      }
    }
  });

  const modulos = Object.entries(catalogo);

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-card font-semibold text-ink">
            {rol ? `Permisos del rol "${rol.nombre}"` : "Nuevo rol"}
          </h2>
          {rol && (
            <Badge tono="neutral">{textoMiembros(rol.empleados_activos, rol.empleados_inactivos)}</Badge>
          )}
        </div>

        {editable && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <Input {...form.register("nombre")} />
            </Field>
            <Field label="Descripción" error={errors.descripcion?.message}>
              <Input placeholder="Qué hace este rol" {...form.register("descripcion")} />
            </Field>
          </div>
        )}

        <div className="overflow-hidden rounded-card border">
          <table className="w-full text-left text-body">
            <thead className="bg-track text-label font-semibold text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  MÓDULO
                </th>
                {COLUMNAS_MATRIZ.map((c) => (
                  <th key={c.titulo} scope="col" className="px-3 py-2.5 font-semibold">
                    {c.titulo.toLowerCase()}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5">
                  OTRAS ACCIONES
                </th>
              </tr>
            </thead>
            <tbody>
              {modulos.map(([modulo, disponibles = []]) => {
                const otras = disponibles.filter((a) => !ACCIONES_EN_COLUMNAS.includes(a));
                const casilla = (accion: string) => {
                  const marcado = permisos[modulo]?.includes(accion) ?? false;
                  // Se puede quitar lo que ya tiene; agregar, solo lo que el rol propio permite.
                  const motivo = !editable ? bloqueo : marcado ? null : escalada.otorgar(modulo, accion);
                  const etiqueta = `${nombreModulo(modulo)}: ${nombreAccion(accion)}`;
                  const control = (
                    <Checkbox
                      aria-label={etiqueta}
                      checked={marcado}
                      disabled={Boolean(motivo)}
                      onCheckedChange={() => alternar(modulo, accion)}
                    />
                  );
                  return editable && motivo ? (
                    <Tooltip texto={motivo}>
                      <span className="inline-flex">{control}</span>
                    </Tooltip>
                  ) : (
                    control
                  );
                };
                return (
                  <tr key={modulo} className="border-t">
                    <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                      {nombreModulo(modulo)}
                    </th>
                    {COLUMNAS_MATRIZ.map((c) => {
                      const accion = c.acciones.find((a) => disponibles.includes(a));
                      return (
                        <td key={c.titulo} className="px-3 py-2.5">
                          {accion ? casilla(accion) : <span className="text-subtle">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      {otras.length === 0 ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {otras.map((accion) => (
                            <label
                              key={accion}
                              className="inline-flex items-center gap-1.5 text-label text-muted"
                            >
                              {nombreAccion(accion)}
                              {casilla(accion)}
                            </label>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Alert tono="advertencia" className="mt-4">
          {bloqueo && !rol?.es_sistema ? `${bloqueo}. ` : ""}
          {escalada.esEmpleado ? "Solo puedes otorgar permisos que tu propio rol tiene. " : ""}
          Los roles del sistema no se pueden editar.
          {rol?.es_sistema && puede("roles", "crear") && (
            <>
              {" "}
              <Link to="?rol=nuevo" className="font-semibold underline">
                Crea un rol propio
              </Link>{" "}
              si necesitas otra combinación.
            </>
          )}
        </Alert>
        {error && (
          <Alert tono="error" className="mt-3">
            {error}
          </Alert>
        )}

        {editable && (
          <div className="mt-4 flex justify-end gap-2">
            {rol && puede("roles", "eliminar") && (
              <Tooltip texto={motivoEliminar ?? "Eliminar este rol"}>
                <span>
                  <Button
                    type="button"
                    variant="danger-outline"
                    disabled={Boolean(motivoEliminar)}
                    onClick={() => setConfirmarEliminar(true)}
                  >
                    Eliminar rol
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button type="submit" disabled={!sucio} cargando={isSubmitting}>
              {rol ? "Guardar cambios" : "Crear rol"}
            </Button>
          </div>
        )}
      </form>

      {rol && (
        <ConfirmDialog
          abierto={confirmarEliminar}
          onAbiertoChange={(abierto) => {
            setConfirmarEliminar(abierto);
            if (!abierto) eliminar.reset();
          }}
          titulo={`¿Eliminar el rol ${rol.nombre}?`}
          descripcion="Se borra definitivamente. Los miembros deben tener otro rol antes."
          confirmar="Eliminar rol"
          peligro
          cargando={eliminar.isPending}
          onConfirmar={() =>
            eliminar.mutate(rol.id_rol, {
              onSuccess: () => {
                setConfirmarEliminar(false);
                onSucio(false);
                onEliminado();
              },
            })
          }
        >
          {eliminar.error && <Alert tono="error">{eliminar.error.message}</Alert>}
        </ConfirmDialog>
      )}
    </Card>
  );
}
