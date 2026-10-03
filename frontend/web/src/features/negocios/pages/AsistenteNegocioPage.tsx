import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { ApiError } from "@/api/errors";
import {
  actualizarNegocio,
  type ActualizarNegocioBody,
  type ActualizarSucursalBody,
  type NegocioGestion,
} from "@/api/negocios";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Cargando, NoEncontrado } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { aplicarErroresApi, soloCambios } from "@/lib/forms";
import {
  erroresSemana,
  PLANTILLAS,
  semanaAApi,
  semanaDesdeApi,
  tieneRangos,
  type Semana,
} from "@/lib/horarios";
import { useAuth } from "@/stores/auth";
import { EditorHorarioSemanal } from "../components/EditorHorarioSemanal";
import { FormDatosNegocio } from "../components/FormDatosNegocio";
import { PasosAsistente } from "../components/PasosAsistente";
import { UbicacionSede } from "../components/UbicacionSede";
import { useActualizarNegocio, useGestion, useGuardarHorarios, useGuardarSede } from "../hooks/useGestion";
import {
  CAMPOS_DATOS_NEGOCIO,
  CAMPOS_SEDE,
  PASOS,
  sedeSchema,
  type Paso,
  type SedeValores,
} from "../schemas";

/**
 * A6 pasos 2 y 3 (`/negocios/:idNegocio/configurar`), y el paso 1 al volver atrás.
 * El paso pendiente sale siempre de la API (`configuracion_pendiente` en /auth/me): no se
 * puede saltar a un paso posterior escribiendo la URL. Solo para el propietario.
 */
export function AsistenteNegocioPage() {
  const { idNegocio } = useParams();
  const id = Number(idNegocio);
  const [params] = useSearchParams();
  const negocioMio = useAuth((s) => s.usuario?.negocios.find((n) => n.id_negocio === id));
  const esPropietario = negocioMio?.relacion === "propietario";
  const gestion = useGestion(id, esPropietario);

  if (!negocioMio) {
    return (
      <AuthCard>
        <NoEncontrado descripcion="Este negocio no existe o no tienes acceso a él." />
      </AuthCard>
    );
  }
  if (!esPropietario) return <Navigate to={`/n/${id}`} replace />;

  const pendiente = negocioMio.configuracion_pendiente;
  const pedido = params.get("paso") as Paso | null;
  // Completo y sin un paso pedido (volver a editar), no hay nada que configurar.
  if (!pendiente && !pedido) return <Navigate to={`/n/${id}`} replace />;
  const tope = PASOS.indexOf(pendiente ?? "horarios");
  const paso: Paso =
    pedido && PASOS.includes(pedido) && PASOS.indexOf(pedido) <= tope ? pedido : PASOS[tope]!;

  let contenido;
  if (gestion.isError)
    contenido = <ErrorConsulta error={gestion.error} reintentar={() => void gestion.refetch()} />;
  else if (!gestion.data) contenido = <Cargando lineas={5} className="p-0" />;
  else if (paso === "negocio") contenido = <PasoNegocio negocio={gestion.data} />;
  else if (paso === "sede") contenido = <PasoSede negocio={gestion.data} />;
  else contenido = <PasoHorarios negocio={gestion.data} />;

  return (
    <AuthCard className="w-[480px]">
      <AuthTitulo titulo="Crea tu negocio" />
      <PasosAsistente actual={paso} />
      {contenido}
    </AuthCard>
  );
}

const irA = (paso: Paso) => `?paso=${paso}`;

function PasoNegocio({ negocio }: { negocio: NegocioGestion }) {
  const navigate = useNavigate();
  const actualizar = useActualizarNegocio(negocio.id_negocio);
  const iniciales = {
    nombre: negocio.nombre,
    tipo: negocio.tipo,
    telefono: negocio.telefono ?? "",
    email: negocio.email ?? "",
    nit: negocio.nit ?? "",
    ciudad: negocio.ciudad,
  };
  return (
    <FormDatosNegocio
      iniciales={iniciales}
      enviando={actualizar.isPending}
      error={actualizar.error}
      onEnviar={(valores, setError) => {
        // El esquema no deja vacíos los obligatorios (nombre, tipo, ciudad): nunca van en null.
        const cambios = soloCambios(valores, iniciales) as ActualizarNegocioBody;
        if (Object.keys(cambios).length === 0) return navigate(irA("sede"));
        actualizar.mutate(cambios, {
          onSuccess: () => navigate(irA("sede")),
          onError: (e) => aplicarErroresApi(setError, e, CAMPOS_DATOS_NEGOCIO),
        });
      }}
      secundario={
        <Button asChild variant="secondary">
          <Link to="/negocios">Salir</Link>
        </Button>
      }
    />
  );
}

function PasoSede({ negocio }: { negocio: NegocioGestion }) {
  const navigate = useNavigate();
  const guardar = useGuardarSede(negocio.id_negocio);
  const sede = negocio.sucursales[0];
  const iniciales: SedeValores = {
    nombre: sede?.nombre ?? "Sede principal",
    direccion: sede?.direccion ?? negocio.direccion ?? "",
    telefono: sede?.telefono ?? negocio.telefono ?? "",
    latitud: sede?.latitud ?? negocio.latitud,
    longitud: sede?.longitud ?? negocio.longitud,
  };
  const form = useForm<SedeValores>({ resolver: zodResolver(sedeSchema), defaultValues: iniciales });
  const { errors, isSubmitted } = form.formState;
  const [direccion, latitud, longitud] = useWatch({
    control: form.control,
    name: ["direccion", "latitud", "longitud"],
  });

  const onSubmit = form.handleSubmit(async (valores) => {
    try {
      if (sede) {
        // El esquema no deja vacíos el nombre ni la dirección: nunca van en null.
        const cambios = soloCambios(valores, iniciales) as ActualizarSucursalBody;
        if (Object.keys(cambios).length > 0) {
          await guardar.mutateAsync({ idSucursal: sede.id_sucursal, cambios });
        }
      } else {
        await guardar.mutateAsync({
          nueva: {
            nombre: valores.nombre,
            direccion: valores.direccion,
            ...(valores.telefono && { telefono: valores.telefono }),
            latitud: valores.latitud,
            longitud: valores.longitud,
          },
        });
      }
    } catch (e) {
      if (e instanceof ApiError) aplicarErroresApi(form.setError, e, CAMPOS_SEDE);
      return;
    }
    // Si el negocio aún no tiene dirección, toma la de su sede principal (no es crítico).
    if (!negocio.direccion && valores.direccion) {
      await actualizarNegocio(negocio.id_negocio, {
        direccion: valores.direccion,
        ...(valores.latitud !== null && { latitud: valores.latitud, longitud: valores.longitud }),
      }).catch(() => undefined);
    }
    navigate(irA("horarios"));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Nombre de la sede *" error={errors.nombre?.message}>
        <Input autoFocus {...form.register("nombre")} />
      </Field>
      <UbicacionSede
        value={{ direccion, latitud, longitud }}
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
      <Field label="Teléfono de la sede" error={errors.telefono?.message}>
        <Input type="tel" {...form.register("telefono")} />
      </Field>
      {guardar.error && guardar.error.status !== 422 && !guardar.error.limitePlan && (
        <Alert tono="error">{guardar.error.message}</Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button asChild variant="secondary">
          <Link to={irA("negocio")}>
            <ArrowLeft /> Atrás
          </Link>
        </Button>
        <Button type="submit" cargando={form.formState.isSubmitting}>
          Continuar <ArrowRight />
        </Button>
      </div>
    </form>
  );
}

function PasoHorarios({ negocio }: { negocio: NegocioGestion }) {
  const navigate = useNavigate();
  const guardar = useGuardarHorarios(negocio.id_negocio);
  const sede = negocio.sucursales[0];
  const [semana, setSemana] = useState<Semana>(() =>
    sede && sede.horarios.length > 0 ? semanaDesdeApi(sede.horarios) : PLANTILLAS[0]!.semana(),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (!sede) return <Navigate to={irA("sede")} replace />;

  const terminar = () => {
    const delCliente = erroresSemana(semana);
    setErrores(delCliente);
    if (Object.keys(delCliente).length > 0) return setMensaje("Corrige los rangos marcados.");
    if (!tieneRangos(semana))
      return setMensaje("Agrega al menos un rango: sin horario, la sede no recibe reservas.");
    setMensaje(null);
    const { horarios, posiciones } = semanaAApi(semana);
    guardar.mutate(
      { idSucursal: sede.id_sucursal, horarios },
      {
        onSuccess: () => navigate(`/n/${negocio.id_negocio}`, { replace: true }),
        onError: (e) => {
          // horarios.N del 422 -> la ficha del día y rango que se envió en la posición N.
          const marcados = Object.fromEntries(
            Object.entries(e.errors).flatMap(([clave, texto]) => {
              const p = posiciones[Number(clave.split(".")[1])];
              return p ? [[`${p.dia}-${p.indice}`, texto]] : [];
            }),
          );
          setErrores(marcados);
          setMensaje(e.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <EditorHorarioSemanal
        compacto
        value={semana}
        onChange={setSemana}
        errores={errores}
        disabled={guardar.isPending}
      />
      {mensaje && <Alert tono="error">{mensaje}</Alert>}
      <div className="flex justify-end gap-2">
        <Button asChild variant="secondary">
          <Link to={irA("sede")}>
            <ArrowLeft /> Atrás
          </Link>
        </Button>
        <Button onClick={terminar} cargando={guardar.isPending}>
          Terminar
        </Button>
      </div>
    </div>
  );
}
