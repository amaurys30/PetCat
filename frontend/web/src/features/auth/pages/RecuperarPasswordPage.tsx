import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { aplicarErroresApi } from "@/lib/forms";
import { useRecuperarPassword } from "../hooks/useAuthMutations";
import { recuperarSchema, type RecuperarValores } from "../schemas";

/** A2 · Recuperar contraseña. La respuesta es la misma exista o no el correo. */
export function RecuperarPasswordPage() {
  const recuperar = useRecuperarPassword();
  const form = useForm<RecuperarValores>({
    resolver: zodResolver(recuperarSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(({ email }) => {
    recuperar.mutate(email, { onError: (e) => aplicarErroresApi(form.setError, e, ["email"]) });
  });

  const error = recuperar.error;
  return (
    <AuthCard>
      <Link
        to="/login"
        className="mb-4 inline-flex items-center gap-1 text-body font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver al inicio de sesión
      </Link>
      <AuthTitulo
        titulo="Recuperar contraseña"
        descripcion="Te enviaremos un enlace para crear una nueva contraseña. Vence en 1 hora."
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Correo electrónico" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" cargando={recuperar.isPending}>
          Enviar enlace
        </Button>
        {recuperar.isSuccess && (
          <Alert tono="exito">
            Si el correo está registrado, recibirás el enlace en unos minutos. Revisa también la carpeta de
            spam.
          </Alert>
        )}
        {error && error.status !== 422 && <Alert tono="error">{error.message}</Alert>}
      </form>
    </AuthCard>
  );
}
