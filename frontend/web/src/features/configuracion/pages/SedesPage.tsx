import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router";
import { ApiError } from "@/api/errors";
import type { ActualizarSucursalBody, NegocioGestion, SucursalGestion } from "@/api/negocios";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EditorHorarioSemanal } from "@/features/negocios/components/EditorHorarioSemanal";
import { UbicacionSede } from "@/features/negocios/components/UbicacionSede";
import { useEliminarSede, useGuardarHorarios, useGuardarSede } from "@/features/negocios/hooks/useGestion";
import { useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { CAMPOS_SEDE, sedeSchema, type SedeValores } from "@/features/negocios/schemas";
import { textoLimite } from "@/features/negocios/textos";
import { aplicarErroresApi, soloCambios } from "@/lib/forms";
import {
  erroresSemana,
  semanaAApi,
  semanaDesdeApi,
  semanasIguales,
  tieneRangos,
  type Semana,
} from "@/lib/horarios";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import { AccionesConfiguracion } from "../ConfiguracionLayout";
import { useConfiguracion } from "../contexto";

const sinUbicacion = (s: SucursalGestion) => s.latitud === null || s.longitud === null;

/** E2 · Sedes y horarios. La sede elegida queda en `?sede=` (o `?sede=nueva`). */
export function SedesPage() {
  const { negocio, puedeEditar } = useConfiguracion();
  const [params, setParams] = useSearchParams();
  const suscripcion = useSuscripcion(negocio.id_negocio);
  const abrirLimitePlan = useUi((s) => s.abrirLimitePlan);
  // Se consulta al salir: los formularios lo actualizan al cambiar y justo después de guardar.
  const sinGuardar = useRef({ datos: false, horario: false });
  const haySinGuardar = useCallback(() => sinGuardar.current.datos || sinGuardar.current.horario, []);
  const marcarDatos = useCallback((sucio: boolean) => {
    sinGuardar.current.datos = sucio;
  }, []);
  const marcarHorario = useCallback((sucio: boolean) => {
    sinGuardar.current.horario = sucio;
  }, []);

  const sedes = negocio.sucursales;
  const pedida = params.get("sede");
  const nueva = puedeEditar && (pedida === "nueva" || sedes.length === 0);
  const sede = nueva ? null : (sedes.find((s) => String(s.id_sucursal) === pedida) ?? sedes[0] ?? null);
  const elegir = (valor: string | null) => setParams(valor ? { sede: valor } : {}, { replace: false });

  const uso = suscripcion.data?.uso.sucursales;
  const plan = suscripcion.data?.plan;
  const enLimite = uso !== undefined && uso.maximo !== -1 && uso.usadas >= uso.maximo;

  return (
    <>
      <AccionesConfiguracion>
        {puedeEditar && (
          <Button
            onClick={() =>
              enLimite && plan
                ? abrirLimitePlan(
                    `Tu plan ${plan.nombre} permite ${textoLimite(uso.maximo, "sede", "sedes", "")}. Para abrir otra, cambia de plan.`,
                  )
                : elegir("nueva")
            }
          >
            <Plus /> Nueva sede
          </Button>
        )}
      </AccionesConfiguracion>

      <div className="grid grid-cols-[340px_1fr] items-start gap-5">
        <Card className="flex flex-col gap-3 p-4">
          {sedes.length === 0 && <p className="text-body text-muted">Este negocio todavía no tiene sedes.</p>}
          {sedes.map((s) => {
            const activa = !nueva && s.id_sucursal === sede?.id_sucursal;
            return (
              <button
                key={s.id_sucursal}
                type="button"
                aria-current={activa ? "true" : undefined}
                onClick={() => elegir(String(s.id_sucursal))}
                className={cn(
                  "rounded-card border p-3.5 text-left transition-colors",
                  activa ? "border-primary bg-selected" : "hover:bg-surface",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-card font-semibold text-ink">{s.nombre}</span>
                  {s.es_principal && <Badge tono="primary">Principal</Badge>}
                  {sinUbicacion(s) && <Badge tono="warning">Sin ubicación</Badge>}
                  {s.horarios.length === 0 && <Badge tono="danger">Sin horario</Badge>}
                </span>
                <span className="mt-1 block text-body text-muted">{s.direccion}</span>
              </button>
            );
          })}
          {sedes.filter(sinUbicacion).map((s) => (
            <p
              key={s.id_sucursal}
              className="rounded-control bg-warning-soft px-3 py-2 text-label text-warning-ink"
            >
              {s.nombre} no tiene coordenadas: no aparece en &quot;Cerca de mí&quot; de la app.
            </p>
          ))}
          {plan && uso && (
            <p className="text-label text-muted">
              Plan {plan.nombre}: {textoLimite(uso.maximo, "sede", "sedes", "sedes ilimitadas")}.
              {uso.maximo !== -1 && uso.usadas > uso.maximo
                ? ` Tienes ${uso.usadas}: las que ya existen siguen funcionando, pero no puedes abrir más.`
                : ""}
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          {(sede || nueva) && (
            <DatosSede
              key={`datos-${sede?.id_sucursal ?? "nueva"}`}
              negocio={negocio}
              sede={sede}
              puedeEditar={puedeEditar}
              onSucio={marcarDatos}
              onCreada={(id) => elegir(String(id))}
              onDesactivada={() => elegir(null)}
            />
          )}
          {sede && (
            <HorarioSede
              key={`horario-${sede.id_sucursal}`}
              negocio={negocio}
              sede={sede}
              puedeEditar={puedeEditar}
              onSucio={marcarHorario}
            />
          )}
        </div>
      </div>
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
    </>
  );
}

function DatosSede({
  negocio,
  sede,
  puedeEditar,
  onSucio,
  onCreada,
  onDesactivada,
}: {
  negocio: NegocioGestion;
  sede: SucursalGestion | null;
  puedeEditar: boolean;
  onSucio: (sucio: boolean) => void;
  onCreada: (idSucursal: number) => void;
  onDesactivada: () => void;
}) {
  const guardar = useGuardarSede(negocio.id_negocio);
  const eliminar = useEliminarSede(negocio.id_negocio);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);
  const iniciales: SedeValores = {
    nombre: sede?.nombre ?? "",
    direccion: sede?.direccion ?? "",
    telefono: sede?.telefono ?? negocio.telefono ?? "",
    latitud: sede?.latitud ?? null,
    longitud: sede?.longitud ?? null,
  };
  const principalInicial = sede?.es_principal ?? false;
  const [principal, setPrincipal] = useState(principalInicial);
  const form = useForm<SedeValores>({ resolver: zodResolver(sedeSchema), defaultValues: iniciales });
  const { errors, isSubmitted, isDirty } = form.formState;
  const [direccion, latitud, longitud] = useWatch({
    control: form.control,
    name: ["direccion", "latitud", "longitud"],
  });
  const sucio = isDirty || principal !== principalInicial;

  useEffect(() => {
    onSucio(sucio);
  }, [sucio, onSucio]);

  const onSubmit = form.handleSubmit(async (valores) => {
    try {
      if (sede) {
        // El esquema no deja vacíos el nombre ni la dirección: nunca van en null.
        const cambios = soloCambios(valores, iniciales) as ActualizarSucursalBody;
        if (principal !== principalInicial) cambios.es_principal = principal;
        if (Object.keys(cambios).length > 0)
          await guardar.mutateAsync({ idSucursal: sede.id_sucursal, cambios });
        form.reset(valores);
      } else {
        const creada = await guardar.mutateAsync({
          nueva: {
            nombre: valores.nombre,
            direccion: valores.direccion,
            ...(valores.telefono && { telefono: valores.telefono }),
            latitud: valores.latitud,
            longitud: valores.longitud,
            ...(principal && { es_principal: true }),
          },
        });
        form.reset(valores);
        onSucio(false);
        onCreada(creada.id_sucursal);
      }
    } catch (e) {
      if (e instanceof ApiError) aplicarErroresApi(form.setError, e, CAMPOS_SEDE);
    }
  });

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card font-semibold text-ink">{sede ? "Datos de la sede" : "Nueva sede"}</h2>
        {sede && puedeEditar && (
          <Button
            variant="link"
            className="text-danger hover:text-danger"
            onClick={() => setConfirmarDesactivar(true)}
          >
            Desactivar sede
          </Button>
        )}
      </div>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!puedeEditar || form.formState.isSubmitting} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <Input {...form.register("nombre")} />
            </Field>
            <Field label="Teléfono" error={errors.telefono?.message}>
              <Input type="tel" {...form.register("telefono")} />
            </Field>
          </div>
          <UbicacionSede
            value={{ direccion, latitud, longitud }}
            disabled={!puedeEditar}
            errores={{
              direccion: errors.direccion?.message,
              latitud: errors.latitud?.message,
              longitud: errors.longitud?.message,
            }}
            onChange={(u) => {
              const opciones = { shouldDirty: true, shouldValidate: isSubmitted };
              form.setValue("direccion", u.direccion, opciones);
              form.setValue("latitud", u.latitud, opciones);
              form.setValue("longitud", u.longitud, opciones);
            }}
          />
          <div className="flex items-start gap-3">
            <Switch
              id="sede-principal"
              checked={principal}
              // Para cambiar la principal se marca otra: desmarcarla daría 409.
              disabled={!puedeEditar || principalInicial}
              onCheckedChange={setPrincipal}
            />
            <div>
              <Label htmlFor="sede-principal" className="text-body font-semibold text-ink">
                Sede principal
              </Label>
              <p className="text-label text-muted">
                {principalInicial
                  ? "Para cambiarla, marca otra sede como principal. Siempre debe haber una."
                  : "La primera sede queda como principal; debe haber siempre una."}
              </p>
            </div>
          </div>
          {puedeEditar && (
            <div className="flex justify-end">
              <Button type="submit" disabled={!sucio} cargando={form.formState.isSubmitting}>
                {sede ? "Guardar cambios" : "Crear sede"}
              </Button>
            </div>
          )}
        </fieldset>
      </form>

      {sede && (
        <ConfirmDialog
          abierto={confirmarDesactivar}
          onAbiertoChange={(abierto) => {
            setConfirmarDesactivar(abierto);
            if (!abierto) eliminar.reset();
          }}
          titulo={`¿Desactivar ${sede.nombre}?`}
          descripcion="La sede deja de aparecer en la app y no recibe más reservas. No se puede si tiene citas futuras."
          confirmar="Desactivar sede"
          peligro
          cargando={eliminar.isPending}
          onConfirmar={() =>
            eliminar.mutate(sede.id_sucursal, {
              onSuccess: () => {
                setConfirmarDesactivar(false);
                onDesactivada();
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

function HorarioSede({
  negocio,
  sede,
  puedeEditar,
  onSucio,
}: {
  negocio: NegocioGestion;
  sede: SucursalGestion;
  puedeEditar: boolean;
  onSucio: (sucio: boolean) => void;
}) {
  const guardar = useGuardarHorarios(negocio.id_negocio);
  const guardada = semanaDesdeApi(sede.horarios);
  const [semana, setSemana] = useState<Semana>(guardada);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmarCerrada, setConfirmarCerrada] = useState(false);
  const sucio = !semanasIguales(semana, guardada);

  useEffect(() => {
    onSucio(sucio);
  }, [sucio, onSucio]);

  const enviar = () => {
    setConfirmarCerrada(false);
    const { horarios, posiciones } = semanaAApi(semana);
    guardar.mutate(
      { idSucursal: sede.id_sucursal, horarios },
      {
        onSuccess: () => {
          setErrores({});
          setMensaje(null);
        },
        onError: (e) => {
          // horarios.N del 422 -> la ficha del día y rango que se envió en la posición N.
          setErrores(
            Object.fromEntries(
              Object.entries(e.errors).flatMap(([clave, texto]) => {
                const p = posiciones[Number(clave.split(".")[1])];
                return p ? [[`${p.dia}-${p.indice}`, texto]] : [];
              }),
            ),
          );
          setMensaje(e.message);
        },
      },
    );
  };

  const guardarSemana = () => {
    const delCliente = erroresSemana(semana);
    setErrores(delCliente);
    if (Object.keys(delCliente).length > 0) return setMensaje("Corrige los rangos marcados.");
    setMensaje(null);
    const otrasAbiertas = negocio.sucursales.some(
      (s) => s.id_sucursal !== sede.id_sucursal && s.horarios.length > 0,
    );
    if (!tieneRangos(semana) && !otrasAbiertas) return setConfirmarCerrada(true);
    enviar();
  };

  return (
    <Card className="p-5">
      <h2 className="text-card font-semibold text-ink">Horario de atención</h2>
      <p className="mt-1 mb-3 text-body text-muted">
        Puedes agregar varios rangos por día (horario partido). Los días sin rangos quedan cerrados.
      </p>
      <EditorHorarioSemanal
        value={semana}
        onChange={setSemana}
        errores={errores}
        disabled={!puedeEditar || guardar.isPending}
      />
      {mensaje && (
        <Alert tono="error" className="mt-3">
          {mensaje}
        </Alert>
      )}
      {puedeEditar && (
        <div className="mt-4 flex justify-end gap-2">
          {sucio && (
            <Button variant="secondary" onClick={() => setSemana(guardada)} disabled={guardar.isPending}>
              Descartar
            </Button>
          )}
          <Button onClick={guardarSemana} disabled={!sucio} cargando={guardar.isPending}>
            Guardar horario
          </Button>
        </div>
      )}
      <ConfirmDialog
        abierto={confirmarCerrada}
        onAbiertoChange={setConfirmarCerrada}
        titulo="Ninguna sede quedará abierta"
        descripcion="Sin horario en ninguna sede, el negocio no recibe reservas y tendrás que configurar el horario de nuevo para usar el panel."
        confirmar="Guardar sin horario"
        peligro
        onConfirmar={enviar}
      />
    </Card>
  );
}
