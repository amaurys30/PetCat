import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { aplicarErroresApi } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useRestablecerPassword } from "../hooks/useAuthMutations";
import { passwordNuevaSchema, REGLAS_PASSWORD, type PasswordNuevaValores } from "../schemas";

const TEXTOS = {
  crear: {
    titulo: "Crea tu contraseña",
    // La API no dice qué negocio registró al cliente (Pendientes de API, A3).
    descripcion: "Un negocio te registró en PetCat. Define una contraseña para activar tu cuenta.",
    exito: "Listo, tu cuenta quedó activa. Ya puedes iniciar sesión.",
  },
  restablecer: {
    titulo: "Restablece tu contraseña",
    descripcion: "Define una contraseña nueva para tu cuenta.",
    exito: "Contraseña restablecida. Ya puedes iniciar sesión.",
  },
} as const;

/**
 * A3 · /crear-password/:token (bienvenida de un cliente registrado por un negocio) y
 * /restablecer-password/:token (Olvidé mi contraseña). Las dos usan POST /auth/reset-password,
 * que no inicia sesión: al terminar se va al login con un aviso.
 */
export function PasswordNuevaPage({ modo }: { modo: keyof typeof TEXTOS }) {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const restablecer = useRestablecerPassword();
  const textos = TEXTOS[modo];

  const form = useForm<PasswordNuevaValores>({
    resolver: zodResolver(passwordNuevaSchema),
    defaultValues: { password: "", confirmacion: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ password }) => {
    restablecer.mutate(
      { token, password },
      {
        onSuccess: () => navigate("/login", { replace: true, state: { aviso: textos.exito } }),
        onError: (e) => aplicarErroresApi(form.setError, e, ["password"]),
      },
    );
  });

  const error = restablecer.error;
  const tokenInvalido = !/^[0-9a-f]{64}$/.test(token) || error?.status === 400 || error?.errors.token;

  return (
    <AuthCard>
      <AuthTitulo titulo={textos.titulo} descripcion={textos.descripcion} />
      {tokenInvalido ? (
        <div className="flex flex-col gap-4">
          <Alert tono="error">
            {error?.status === 400
              ? error.message
              : "El enlace no es válido o ya venció. Solicita uno nuevo."}
          </Alert>
          <Button asChild size="lg" className="w-full">
            <Link to="/recuperar-password">Solicitar un enlace nuevo</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Nueva contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" autoFocus {...form.register("password")} />
          </Field>
          <Field label="Confirmar contraseña" error={errors.confirmacion?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("confirmacion")} />
          </Field>

          <div className="rounded-control bg-surface px-3 py-2.5" aria-live="polite">
            <p className="mb-1.5 text-label font-semibold text-muted">Tu contraseña debe tener:</p>
            <ul className="flex flex-col gap-1.5">
              {REGLAS_PASSWORD.map((regla) => {
                const cumple = regla.cumple(password);
                return (
                  <li key={regla.texto} className="flex items-center gap-2 text-body text-ink">
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        cumple ? "border-primary bg-primary text-white" : "border-subtle bg-white",
                      )}
                    >
                      {cumple && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    {regla.texto}
                    <span className="sr-only">{cumple ? "(cumple)" : "(falta)"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {error && error.status !== 422 && error.status !== 400 && (
            <Alert tono="error">{error.message}</Alert>
          )}

          <Button type="submit" size="lg" className="w-full" cargando={restablecer.isPending}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
