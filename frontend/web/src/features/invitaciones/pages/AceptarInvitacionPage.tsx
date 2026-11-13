import { zodResolver } from "@hookform/resolvers/zod";
import { MailX } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { Invitacion } from "@/api/invitaciones";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Avatar } from "@/components/common/Avatar";
import { Cargando } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { usePoliticaVigente } from "@/features/auth/hooks/useAuthMutations";
import {
  invitacionExistenteSchema,
  invitacionNuevaSchema,
  type InvitacionExistenteValores,
  type InvitacionNuevaValores,
} from "@/features/auth/schemas";
import { aplicarErroresApi } from "@/lib/forms";
import { fechaHoraLarga } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { useAceptarInvitacion, useInvitacion } from "../hooks/useInvitacion";

const TOKEN_VALIDO = /^[0-9a-f]{64}$/i;

/**
 * A4 · Aceptar invitación (`/invitacion/:token`, el enlace del correo). Sin cuenta se crea
 * con contraseña nueva; con cuenta se vincula con la contraseña actual. Al aceptar entra
 * al negocio que invitó; si había otra sesión abierta, la reemplaza.
 */
export function AceptarInvitacionPage() {
  const { token = "" } = useParams();
  const formatoValido = TOKEN_VALIDO.test(token);
  const invitacion = useInvitacion(token, formatoValido);

  if (!formatoValido || invitacion.error?.status === 404 || invitacion.error?.status === 422) {
    return (
      <NoUsable
        titulo="Invitación no encontrada"
        mensaje="Revisa que hayas abierto el enlace completo del correo."
      />
    );
  }
  if (invitacion.error?.status === 409) {
    return <NoUsable titulo="Esta invitación ya no se puede usar" mensaje={invitacion.error.message} />;
  }
  if (invitacion.isError) {
    return (
      <AuthCard>
        <ErrorConsulta error={invitacion.error} reintentar={() => void invitacion.refetch()} />
      </AuthCard>
    );
  }
  if (!invitacion.data) {
    return (
      <AuthCard>
        <Cargando lineas={4} className="p-0" />
      </AuthCard>
    );
  }
  return <Formulario token={token} invitacion={invitacion.data} />;
}

function NoUsable({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  const conSesion = useAuth((s) => s.estado === "autenticado");
  return (
    <AuthCard>
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
        <MailX className="size-6" aria-hidden />
      </span>
      <AuthTitulo titulo={titulo} descripcion={mensaje} />
      <p className="mb-5 text-body text-muted">
        Si necesitas una invitación nueva, pide al negocio que te la reenvíe desde su panel.
      </p>
      <Button asChild size="lg" className="w-full">
        {conSesion ? <Link to="/panel">Ir al panel</Link> : <Link to="/login">Ir a iniciar sesión</Link>}
      </Button>
    </AuthCard>
  );
}

function Formulario({ token, invitacion }: { token: string; invitacion: Invitacion }) {
  const usuarioActual = useAuth((s) => s.usuario);
  const otraCuenta = usuarioActual && usuarioActual.email !== invitacion.email ? usuarioActual.email : null;

  return (
    <AuthCard>
      <header className="mb-4 flex items-center gap-3">
        <Avatar nombre={invitacion.negocio.nombre} fotoUrl={invitacion.negocio.logo_url} tamano="lg" />
        <div className="min-w-0">
          <h1 className="text-card font-semibold text-ink">{invitacion.negocio.nombre}</h1>
          <p className="text-body text-muted">te invitó como {invitacion.rol.nombre}</p>
        </div>
      </header>
      <Alert tono="info" className="mb-4">
        Invitación para {invitacion.email} · vence el {fechaHoraLarga(invitacion.expiracion)}
      </Alert>
      {otraCuenta && (
        <Alert tono="advertencia" className="mb-4">
          Tienes la sesión iniciada como {otraCuenta}. Al aceptar, se cerrará y entrarás como{" "}
          {invitacion.email}.
        </Alert>
      )}
      {invitacion.cuenta_existente ? (
        <CuentaExistente token={token} invitacion={invitacion} />
      ) : (
        <CuentaNueva token={token} invitacion={invitacion} />
      )}
    </AuthCard>
  );
}

function useAlAceptar(invitacion: Invitacion) {
  const navigate = useNavigate();
  return () => navigate(`/n/${invitacion.negocio.id_negocio}`, { replace: true });
}

function CuentaNueva({ token, invitacion }: { token: string; invitacion: Invitacion }) {
  const aceptar = useAceptarInvitacion(token);
  const alAceptar = useAlAceptar(invitacion);
  const politica = usePoliticaVigente();
  const requierePolitica = invitacion.requiere_aceptar_politica;

  const form = useForm<InvitacionNuevaValores>({
    resolver: zodResolver(invitacionNuevaSchema(requierePolitica)),
    defaultValues: {
      nombre: invitacion.empleado.nombre,
      apellido: invitacion.empleado.apellido,
      password: "",
      acepta_politica_datos: false,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ acepta_politica_datos, ...valores }) => {
    aceptar.mutate(
      { ...valores, ...(acepta_politica_datos && { acepta_politica_datos: true }) },
      {
        onSuccess: alAceptar,
        onError: (e) =>
          aplicarErroresApi(form.setError, e, ["nombre", "apellido", "password", "acepta_politica_datos"]),
      },
    );
  });

  const error = aceptar.error;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" error={errors.nombre?.message}>
          <Input autoComplete="given-name" {...form.register("nombre")} />
        </Field>
        <Field label="Apellido" error={errors.apellido?.message}>
          <Input autoComplete="family-name" {...form.register("apellido")} />
        </Field>
      </div>
      <Field
        label="Contraseña"
        error={errors.password?.message}
        ayuda="Crea una contraseña de 8 a 72 caracteres, con al menos una letra y un número."
      >
        <PasswordInput autoComplete="new-password" autoFocus {...form.register("password")} />
      </Field>

      {requierePolitica && (
        <div>
          <div className="flex items-start gap-2">
            <Controller
              control={form.control}
              name="acepta_politica_datos"
              render={({ field }) => (
                <Checkbox
                  id="acepta-politica"
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={errors.acepta_politica_datos ? true : undefined}
                />
              )}
            />
            <Label htmlFor="acepta-politica" className="text-body font-normal text-ink">
              Acepto la política de tratamiento de datos personales (Ley 1581 de 2012).
            </Label>
          </div>
          {politica.data?.url && (
            <a
              href={politica.data.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 ml-6 inline-block text-label font-semibold text-primary hover:underline"
            >
              Leer la política (versión {politica.data.version})
            </a>
          )}
          {errors.acepta_politica_datos && (
            <p className="mt-1 ml-6 text-label text-danger">{errors.acepta_politica_datos.message}</p>
          )}
        </div>
      )}

      {error && error.status !== 422 && <Alert tono="error">{error.message}</Alert>}

      <Button type="submit" size="lg" className="w-full" cargando={aceptar.isPending}>
        Aceptar y entrar
      </Button>
    </form>
  );
}

function CuentaExistente({ token, invitacion }: { token: string; invitacion: Invitacion }) {
  const aceptar = useAceptarInvitacion(token);
  const alAceptar = useAlAceptar(invitacion);
  const form = useForm<InvitacionExistenteValores>({
    resolver: zodResolver(invitacionExistenteSchema),
    defaultValues: { password: "" },
  });
  const recuperar = `/recuperar-password?email=${encodeURIComponent(invitacion.email)}`;

  const onSubmit = form.handleSubmit((valores) => {
    aceptar.mutate(valores, {
      onSuccess: alAceptar,
      onError: (e) => {
        // Contraseña incorrecta: va en el campo, como en el login.
        if (e.status === 401) form.setError("password", { type: "server", message: e.message });
        else aplicarErroresApi(form.setError, e, ["password"]);
      },
    });
  });

  const error = aceptar.error;
  const mostrarAlerta = error && error.status !== 401 && error.status !== 422;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-body text-muted">
        Ya tienes una cuenta en PetCat con este correo. Escribe tu contraseña actual para unirte al equipo.
      </p>
      <Field label="Correo electrónico">
        <Input type="email" value={invitacion.email} readOnly className="bg-surface text-muted" />
      </Field>
      <Field label="Contraseña actual" error={form.formState.errors.password?.message}>
        <PasswordInput autoComplete="current-password" autoFocus {...form.register("password")} />
      </Field>
      <Link to={recuperar} className="-mt-2 text-body font-semibold text-primary hover:underline">
        ¿La olvidaste?
      </Link>

      {mostrarAlerta && (
        <Alert tono="error">
          {error.message}
          {error.status === 403 && (
            <>
              {" "}
              <Link to={recuperar} className="font-semibold underline">
                Restablecer contraseña
              </Link>
            </>
          )}
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" cargando={aceptar.isPending}>
        Aceptar y entrar
      </Button>
    </form>
  );
}
