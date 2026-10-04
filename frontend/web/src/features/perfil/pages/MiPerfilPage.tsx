import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarClock, CheckCircle2, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { Me } from "@/api/types";
import { Avatar } from "@/components/common/Avatar";
import { AvisoCambiosSinGuardar } from "@/components/common/AvisoCambiosSinGuardar";
import { SubidorImagen } from "@/components/common/SubidorImagen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
import { Input, NativeSelect, PasswordInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { aviso } from "@/components/ui/toaster";
import { ReenviarVerificacion } from "@/features/auth/components/ReenviarVerificacion";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { rolEnNegocio, textoPlan } from "@/features/negocios/textos";
import { aplicarErroresApi, soloCambios } from "@/lib/forms";
import { fechaCorta } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { useActualizarPerfil, useCambiarPassword, useFotoPerfil } from "../hooks/usePerfil";
import {
  cambiarPasswordSchema,
  datosPersonalesSchema,
  type CambiarPasswordValores,
  type DatosPersonalesValores,
} from "../schemas";

/** E6 · Mi perfil (`/n/:id/mi-perfil`, desde el menú del avatar). La cuenta personal, no la del negocio. */
export function MiPerfilPage() {
  const usuario = useAuth((s) => s.usuario);
  if (!usuario) return null;
  return (
    <div className="grid grid-cols-[1fr_380px] items-start gap-5">
      <div className="flex flex-col gap-5">
        <DatosPersonales usuario={usuario} />
        <Seguridad />
      </div>
      <div className="flex flex-col gap-5">
        <MiDisponibilidad />
        <Notificaciones usuario={usuario} />
        <MisNegocios usuario={usuario} />
        <Privacidad usuario={usuario} />
        <CerrarSesion />
      </div>
    </div>
  );
}

function DatosPersonales({ usuario }: { usuario: Me }) {
  const actualizar = useActualizarPerfil();
  const foto = useFotoPerfil();
  const iniciales: DatosPersonalesValores = {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono ?? "",
    idioma: usuario.idioma === "en" ? "en" : "es",
  };
  const form = useForm<DatosPersonalesValores>({
    resolver: zodResolver(datosPersonalesSchema),
    defaultValues: iniciales,
  });
  const { errors, isDirty } = form.formState;
  const sucio = useRef(false);
  const haySinGuardar = useCallback(() => sucio.current, []);
  useEffect(() => {
    sucio.current = isDirty;
  }, [isDirty]);

  const onSubmit = form.handleSubmit((valores) => {
    // El esquema no deja vacíos el nombre ni el apellido: nunca van en null.
    const cambios = soloCambios(valores, iniciales) as Parameters<typeof actualizar.mutate>[0];
    if (Object.keys(cambios).length === 0) return;
    actualizar.mutate(cambios, {
      onSuccess: () => {
        form.reset(valores);
        aviso.exito("Datos guardados");
      },
      onError: (e) => {
        if (!aplicarErroresApi(form.setError, e, ["nombre", "apellido", "telefono", "idioma"]))
          aviso.error(e.message);
      },
    });
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-card font-semibold text-ink">Datos personales</h2>
      <SubidorImagen
        etiqueta="Foto"
        articulo="la"
        ayuda="JPG, PNG o WebP · hasta 5 MB · se eliminan los datos de ubicación"
        maxMb={5}
        forma="circulo"
        nombre={`${usuario.nombre} ${usuario.apellido}`}
        urlActual={usuario.foto_url}
        onSubir={(archivo, onProgreso) => foto.subir.mutateAsync({ archivo, onProgreso })}
        onQuitar={() => foto.quitar.mutateAsync()}
      />
      <form onSubmit={onSubmit} noValidate className="mt-5">
        <fieldset disabled={actualizar.isPending} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <Input autoComplete="given-name" {...form.register("nombre")} />
            </Field>
            <Field label="Apellido *" error={errors.apellido?.message}>
              <Input autoComplete="family-name" {...form.register("apellido")} />
            </Field>
            <Field label="Correo electrónico" ayuda="No se puede cambiar por ahora.">
              <Input value={usuario.email} readOnly className="bg-surface text-muted" />
            </Field>
            <Field label="Teléfono" error={errors.telefono?.message}>
              <Input type="tel" autoComplete="tel" {...form.register("telefono")} />
            </Field>
            <Field label="Idioma">
              <NativeSelect {...form.register("idioma")}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </NativeSelect>
            </Field>
          </div>
          {usuario.email_verificado ? (
            <p className="flex items-center gap-1.5 text-label text-primary-dark">
              <CheckCircle2 className="size-3.5" aria-hidden /> Correo verificado
            </p>
          ) : (
            <ReenviarVerificacion />
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty} cargando={actualizar.isPending}>
              Guardar cambios
            </Button>
          </div>
        </fieldset>
      </form>
      <AvisoCambiosSinGuardar haySinGuardar={haySinGuardar} />
    </Card>
  );
}

function Seguridad() {
  const cambiar = useCambiarPassword();
  const form = useForm<CambiarPasswordValores>({
    resolver: zodResolver(cambiarPasswordSchema),
    defaultValues: { password_actual: "", password_nueva: "", confirmacion: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ password_actual, password_nueva }) =>
    cambiar.mutate(
      { password_actual, password_nueva },
      {
        onSuccess: () => {
          form.reset();
          aviso.exito("Contraseña actualizada. Se cerraron tus sesiones en otros dispositivos.");
        },
        onError: (e) => aplicarErroresApi(form.setError, e, ["password_actual", "password_nueva"]),
      },
    ),
  );

  const error = cambiar.error;
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-card font-semibold text-ink">Seguridad</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Contraseña actual" error={errors.password_actual?.message}>
          <PasswordInput autoComplete="current-password" {...form.register("password_actual")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Nueva contraseña"
            error={errors.password_nueva?.message}
            ayuda="Entre 8 y 72 caracteres, con al menos una letra y un número."
          >
            <PasswordInput autoComplete="new-password" {...form.register("password_nueva")} />
          </Field>
          <Field label="Confirmar nueva contraseña" error={errors.confirmacion?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("confirmacion")} />
          </Field>
        </div>
        <Alert tono="info">Al cambiarla se cerrarán tus sesiones en otros dispositivos.</Alert>
        {error && error.status !== 422 && <Alert tono="error">{error.message}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" cargando={cambiar.isPending}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Notificaciones({ usuario }: { usuario: Me }) {
  const actualizar = useActualizarPerfil();
  // Se guardan al instante: el interruptor cambia ya y vuelve atrás si la API falla.
  const [push, setPush] = useState(usuario.notif_push);
  const [correo, setCorreo] = useState(usuario.notif_email);

  const cambiar = (campo: "notif_push" | "notif_email", valor: boolean, poner: (v: boolean) => void) => {
    poner(valor);
    actualizar.mutate(
      { [campo]: valor },
      {
        onError: (e) => {
          poner(!valor);
          aviso.error(e.message);
        },
      },
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-card font-semibold text-ink">Notificaciones</h2>
      <div className="flex items-start gap-3">
        <Switch id="notif-push" checked={push} onCheckedChange={(v) => cambiar("notif_push", v, setPush)} />
        <div>
          <Label htmlFor="notif-push" className="text-body font-semibold text-ink">
            Notificaciones push
          </Label>
          <p className="text-label text-muted">En la app móvil PetCat, si la tienes instalada.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Switch
          id="notif-email"
          checked={correo}
          onCheckedChange={(v) => cambiar("notif_email", v, setCorreo)}
        />
        <div>
          <Label htmlFor="notif-email" className="text-body font-semibold text-ink">
            Correo electrónico
          </Label>
          <p className="text-label text-muted">Citas nuevas y avisos del plan cuando no tienes la app.</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Acceso a la disponibilidad propia en el negocio activo, para quien tiene registro de
 * empleado en él: un profesional sin empleados.ver no tiene Equipo en el menú. La API le deja
 * ver la suya siempre; editarla sigue exigiendo configuracion.editar.
 */
function MiDisponibilidad() {
  const negocio = useNegocioActivo();
  if (negocio.id_empleado === null) return null;
  return (
    <Card className="p-5">
      <h2 className="text-card font-semibold text-ink">Mi disponibilidad</h2>
      <p className="mt-1 mb-3 text-body text-muted">
        Tu horario semanal, bloqueos y vacaciones en {negocio.nombre}, y en qué horas atiendes cada día.
      </p>
      <Button asChild variant="secondary">
        <Link to={`../equipo/${negocio.id_empleado}/disponibilidad`}>
          <CalendarClock /> Ver mi disponibilidad
        </Link>
      </Button>
    </Card>
  );
}

function MisNegocios({ usuario }: { usuario: Me }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-card font-semibold text-ink">Mis negocios</h2>
      {usuario.negocios.length === 0 ? (
        <p className="text-body text-muted">Todavía no tienes negocios.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {usuario.negocios.map((n) => (
            <li key={n.id_negocio} className="flex items-center gap-3 rounded-control bg-surface p-3">
              <Avatar nombre={n.nombre} fotoUrl={n.logo_miniatura_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">{n.nombre}</span>
                <span className="block text-label text-muted">{rolEnNegocio(n)}</span>
              </span>
              <Badge tono="neutral">{textoPlan(n.plan)}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-label text-muted">
        Tu perfil profesional (especialidad y foto) se edita dentro de cada negocio, en Equipo.
      </p>
    </Card>
  );
}

function Privacidad({ usuario }: { usuario: Me }) {
  const aceptada = usuario.politica_aceptada;
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-card font-semibold text-ink">Privacidad</h2>
      <div className="grid grid-cols-[120px_1fr] gap-3 text-body">
        <span className="text-muted">Política de datos</span>
        <span className="text-ink">
          {aceptada
            ? `Aceptada · versión ${aceptada.version} · ${fechaCorta(aceptada.fecha.slice(0, 10))}`
            : "Sin aceptar"}
        </span>
      </div>
      {usuario.politica.url && (
        <a
          href={usuario.politica.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-body font-semibold text-primary hover:underline"
        >
          Ver política de tratamiento de datos <ArrowRight className="size-3.5" aria-hidden />
        </a>
      )}
    </Card>
  );
}

function CerrarSesion() {
  const salir = useAuth((s) => s.salir);
  return (
    <Button variant="danger-outline" className="w-full" onClick={() => void salir()}>
      <LogOut /> Cerrar sesión
    </Button>
  );
}
