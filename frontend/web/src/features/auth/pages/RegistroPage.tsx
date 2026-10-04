import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { aplicarErroresApi } from "@/lib/forms";
import { usePoliticaVigente, useRegistro } from "../hooks/useAuthMutations";
import { registroSchema, type RegistroValores } from "../schemas";

const CAMPOS = ["nombre", "apellido", "email", "telefono", "password", "acepta_politica_datos"] as const;

/**
 * A7 · Crear cuenta. Al crearla entra con las mismas credenciales y SoloAnonimo lo
 * lleva a /negocios, que sin negocios muestra la bienvenida (crear negocio o invitación).
 */
export function RegistroPage() {
  const navigate = useNavigate();
  const registro = useRegistro();
  const politica = usePoliticaVigente();

  const form = useForm<RegistroValores>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      password: "",
      acepta_politica_datos: false,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((valores) => {
    registro.mutate(valores, {
      onSuccess: (usuario) => {
        if (!usuario) {
          navigate("/login", {
            replace: true,
            state: { aviso: "Tu cuenta quedó creada. Inicia sesión para continuar." },
          });
        }
      },
      onError: (error) => aplicarErroresApi(form.setError, error, CAMPOS),
    });
  });

  const error = registro.error;
  const urlPolitica = politica.data?.url;

  return (
    <AuthCard>
      <AuthTitulo
        titulo="Crea tu cuenta"
        descripcion="Regístrate para crear tu negocio en PetCat o aceptar invitaciones de un equipo."
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre *" error={errors.nombre?.message}>
            <Input autoComplete="given-name" autoFocus {...form.register("nombre")} />
          </Field>
          <Field label="Apellido *" error={errors.apellido?.message}>
            <Input autoComplete="family-name" {...form.register("apellido")} />
          </Field>
        </div>
        <Field label="Correo electrónico *" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Teléfono" error={errors.telefono?.message}>
          <Input type="tel" autoComplete="tel" {...form.register("telefono")} />
        </Field>
        <Field
          label="Contraseña *"
          error={errors.password?.message}
          ayuda="Entre 8 y 72 caracteres, con al menos una letra y un número."
        >
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>

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
              Acepto la política de tratamiento de datos personales (Ley 1581 de 2012). *
            </Label>
          </div>
          {urlPolitica && (
            <a
              href={urlPolitica}
              target="_blank"
              rel="noreferrer"
              className="mt-1 ml-6 inline-block text-label font-semibold text-primary hover:underline"
            >
              Leer la política
              {politica.data ? ` (versión ${politica.data.version})` : ""}
            </a>
          )}
          {errors.acepta_politica_datos && (
            <p className="mt-1 ml-6 text-label text-danger">{errors.acepta_politica_datos.message}</p>
          )}
        </div>

        {error && error.status !== 422 && (
          <Alert tono="error">
            {error.message}
            {error.status === 409 && (
              <>
                {" "}
                <Link
                  to={`/recuperar-password?email=${encodeURIComponent(form.getValues("email"))}`}
                  className="font-semibold underline"
                >
                  Olvidé mi contraseña
                </Link>
              </>
            )}
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" cargando={registro.isPending}>
          Crear cuenta
        </Button>
      </form>

      <p className="mt-5 text-body">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      </p>
    </AuthCard>
  );
}
