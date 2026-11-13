import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LinkIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Cargando } from "@/components/common/EstadoPantalla";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { aplicarErroresApi } from "@/lib/forms";
import { useAuth } from "@/stores/auth";
import { usePedirVerificacion, useReenviarVerificacion, useVerificarEmail } from "../hooks/useAuthMutations";
import { emailSchema, type EmailValores } from "../schemas";

const TOKEN_VALIDO = /^[0-9a-f]{64}$/;

/**
 * A8 · Verificación de correo (`/verificar-email/:token`, el enlace del correo).
 * Funciona con o sin sesión. El token sirve una sola vez, así que la API se llama
 * una sola vez aunque StrictMode monte el efecto dos veces.
 */
export function VerificarEmailPage() {
  const { token = "" } = useParams();
  const conSesion = useAuth((s) => s.estado === "autenticado");
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  const verificar = useVerificarEmail();
  const llamado = useRef(false);
  const formatoValido = TOKEN_VALIDO.test(token);

  useEffect(() => {
    if (llamado.current || !formatoValido) return;
    llamado.current = true;
    verificar.mutate(token, {
      // Con sesión, el perfil pasa a email_verificado (o se consulta para saber si ya lo estaba).
      onSettled: () => {
        if (useAuth.getState().estado === "autenticado") void recargarUsuario().catch(() => undefined);
      },
    });
  }, [token, formatoValido, verificar, recargarUsuario]);

  if (formatoValido && (verificar.isIdle || verificar.isPending)) {
    return (
      <AuthCard>
        <AuthTitulo titulo="Verificando tu correo…" />
        <Cargando lineas={2} className="p-0" />
      </AuthCard>
    );
  }

  if (verificar.isSuccess) return <Verificado conSesion={conSesion} />;

  const status = verificar.error?.status;
  if (formatoValido && status !== 400) {
    return (
      <AuthCard>
        <AuthTitulo titulo="No pudimos verificar tu correo" />
        <Alert tono="error">{verificar.error?.message}</Alert>
        <Button className="mt-4 w-full" onClick={() => verificar.mutate(token)}>
          Intentar de nuevo
        </Button>
      </AuthCard>
    );
  }

  return conSesion ? <EnlaceInvalidoConSesion /> : <EnlaceInvalidoSinSesion />;
}

function IconoExito() {
  return (
    <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
      <Check className="size-6" strokeWidth={3} aria-hidden />
    </span>
  );
}

function Verificado({ conSesion }: { conSesion: boolean }) {
  const email = useAuth((s) => s.usuario?.email);
  return (
    <AuthCard>
      <IconoExito />
      <AuthTitulo
        titulo="¡Correo verificado!"
        descripcion={
          email
            ? `Tu correo ${email} quedó confirmado. Ya puedes usar todas las funciones de PetCat.`
            : "Tu correo quedó confirmado. Ya puedes usar todas las funciones de PetCat."
        }
      />
      <Button asChild size="lg" className="w-full">
        {conSesion ? <Link to="/panel">Ir al panel</Link> : <Link to="/login">Iniciar sesión</Link>}
      </Button>
    </AuthCard>
  );
}

const TEXTO_INVALIDO = "Este enlace ya no es válido. Los enlaces de verificación vencen a las 24 horas.";

function EnlaceInvalidoConSesion() {
  const usuario = useAuth((s) => s.usuario);
  const reenviar = useReenviarVerificacion();

  // Pudo abrir un enlace viejo con el correo ya verificado.
  if (usuario?.email_verificado) {
    return (
      <AuthCard>
        <IconoExito />
        <AuthTitulo
          titulo="Tu correo ya está verificado"
          descripcion={`${usuario.email} ya estaba confirmado; este enlace ya no hace falta.`}
        />
        <Button asChild size="lg" className="w-full">
          <Link to="/panel">Ir al panel</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <EncabezadoInvalido />
      {reenviar.isSuccess ? (
        <Alert tono="exito">
          Te enviamos un enlace nuevo a {reenviar.data.email}. Revisa también la carpeta de spam.
        </Alert>
      ) : (
        <Button size="lg" className="w-full" cargando={reenviar.isPending} onClick={() => reenviar.mutate()}>
          Enviarme un enlace nuevo
        </Button>
      )}
      {reenviar.isError && (
        <Alert tono={reenviar.error.status === 429 ? "advertencia" : "error"} className="mt-3">
          {reenviar.error.message}
        </Alert>
      )}
      <Link to="/panel" className="mt-4 inline-block text-body font-semibold text-primary hover:underline">
        Ir al panel
      </Link>
    </AuthCard>
  );
}

function EnlaceInvalidoSinSesion() {
  const pedir = usePedirVerificacion();
  const form = useForm<EmailValores>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const onSubmit = form.handleSubmit(({ email }) =>
    pedir.mutate(email, { onError: (e) => aplicarErroresApi(form.setError, e, ["email"]) }),
  );

  return (
    <AuthCard>
      <EncabezadoInvalido />
      {pedir.isSuccess ? (
        <Alert tono="exito">
          Si el correo está registrado y sin verificar, te enviamos un enlace nuevo. Revisa también la carpeta
          de spam.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Correo electrónico" error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" cargando={pedir.isPending}>
            Enviarme un enlace nuevo
          </Button>
          {pedir.isError && pedir.error.status !== 422 && <Alert tono="error">{pedir.error.message}</Alert>}
        </form>
      )}
      <Link to="/login" className="mt-4 inline-block text-body font-semibold text-primary hover:underline">
        Ir a iniciar sesión
      </Link>
    </AuthCard>
  );
}

function EncabezadoInvalido() {
  return (
    <>
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
        <LinkIcon className="size-6" aria-hidden />
      </span>
      <AuthTitulo titulo="Enlace vencido o ya usado" descripcion={TEXTO_INVALIDO} />
    </>
  );
}
