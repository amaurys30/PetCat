import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { destinoInicial } from "@/app/destino";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { aplicarErroresApi } from "@/lib/forms";
import { useLogin } from "../hooks/useAuthMutations";
import { loginSchema, type LoginValores } from "../schemas";

interface EstadoNavegacion {
  desde?: { pathname: string };
  aviso?: string;
}

/** A1 · Iniciar sesión */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const estado = (location.state ?? {}) as EstadoNavegacion;
  const [params] = useSearchParams();
  const login = useLogin();

  const form = useForm<LoginValores>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", recordar: true },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((valores) => {
    login.mutate(valores, {
      onSuccess: (usuario) => navigate(destinoInicial(usuario, estado.desde?.pathname), { replace: true }),
      onError: (error) => aplicarErroresApi(form.setError, error, ["email", "password"]),
    });
  });

  const error = login.error;
  const bloqueada = error?.status === 403 && /bloquead/i.test(error.message);

  return (
    <AuthCard>
      <AuthTitulo
        titulo="Iniciar sesión"
        descripcion="Ingresa con la cuenta de tu negocio o la invitación que recibiste."
      />

      {params.get("sesion") === "expirada" && !error && (
        <Alert tono="advertencia" className="mb-4">
          Tu sesión expiró. Por seguridad la cerramos; vuelve a ingresar para continuar.
        </Alert>
      )}
      {estado.aviso && !error && (
        <Alert tono="exito" className="mb-4">
          {estado.aviso}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Correo electrónico" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </Field>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="recordar"
              render={({ field }) => (
                <Checkbox
                  id="recordar"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            <Label htmlFor="recordar" className="text-body font-normal text-ink">
              Recordarme
            </Label>
          </div>
          <Link to="/recuperar-password" className="text-body font-semibold text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error && error.status !== 422 && (
          <Alert tono="error">
            {error.message}
            {bloqueada && (
              <>
                {" "}
                <Link to="/recuperar-password" className="font-semibold underline">
                  Restablecer contraseña
                </Link>
              </>
            )}
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" cargando={login.isPending}>
          Ingresar
        </Button>
      </form>

      <p className="mt-5 text-body text-muted">
        ¿Aún no tienes negocio en PetCat?{" "}
        <Link to="/registro" className="font-semibold text-primary hover:underline">
          Regístrate
        </Link>{" "}
        y créalo en 2 minutos.
      </p>
    </AuthCard>
  );
}
