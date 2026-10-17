import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CorreoAsignado } from "@/api/clientes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { useAsignarCorreo } from "../hooks/useClientes";

const correoSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribe el correo")
    .pipe(z.email("Correo inválido").max(150)),
});
type CorreoValores = z.infer<typeof correoSchema>;

/**
 * Agregar el correo a un cliente sin cuenta, o corregir el de un cliente que este negocio
 * registró y que aún no activó su cuenta. En los dos casos recibe la bienvenida para crear
 * su contraseña; al corregir, el enlace enviado a la dirección anterior deja de servir.
 */
export function CorreoClienteDialog({
  idUsuario,
  nombre,
  correoActual,
  onCerrar,
  onGuardado,
}: {
  idUsuario: number;
  nombre: string;
  correoActual: string | null;
  onCerrar: () => void;
  onGuardado: (resultado: CorreoAsignado) => void;
}) {
  const negocio = useNegocioActivo();
  const asignar = useAsignarCorreo(negocio.id_negocio, idUsuario);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const corrigiendo = correoActual !== null;
  const form = useForm<CorreoValores>({
    resolver: zodResolver(correoSchema),
    defaultValues: { email: correoActual ?? "" },
  });
  const { errors } = form.formState;

  const enviar = form.handleSubmit(({ email }) => {
    setErrorGeneral(null);
    asignar.mutate(email, {
      onSuccess: onGuardado,
      onError: (error) => {
        if (error.status === 409 && error.errors.email) {
          form.setError("email", { message: error.message });
          return;
        }
        if (!aplicarErroresApi(form.setError, error, ["email"])) setErrorGeneral(error.message);
      },
    });
  });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{corrigiendo ? "Corregir correo" : "Agregar correo"}</DialogTitle>
        <DialogDescription>
          {corrigiendo
            ? `${nombre} aún no activa su cuenta. Le enviaremos una bienvenida nueva a este correo y el enlace que fue a ${correoActual} dejará de servir.`
            : `Le enviaremos a ${nombre} un correo de bienvenida para que cree su contraseña. Desde ahí recibirá recordatorios y podrá usar la app con sus mascotas.`}
        </DialogDescription>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <Field label="Correo" error={errors.email?.message}>
            <Input type="email" autoComplete="off" autoFocus {...form.register("email")} />
          </Field>
          {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
          <Alert tono="info" className="flex gap-2">
            <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              El enlace vence en 7 días. Cuando el cliente cree su contraseña, solo él podrá cambiar su
              correo.
            </span>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={asignar.isPending}>
              {corrigiendo ? "Corregir y enviar" : "Agregar y enviar bienvenida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
