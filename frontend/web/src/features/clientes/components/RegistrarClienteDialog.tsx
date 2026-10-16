import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ClienteRegistrado } from "@/api/clientes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { useRegistrarCliente } from "../hooks/useClientes";
import {
  CAMPOS_REGISTRO,
  mascotaVacia,
  registroAApi,
  registroSchema,
  type RegistroValores,
} from "../schemas";
import { CamposMascota } from "./CamposMascota";

/**
 * C3 · Registrar cliente sin app, con su primera mascota y la autorización de datos de la
 * Ley 1581. Con correo recibe la bienvenida para crear su contraseña; sin correo queda sin
 * cuenta (el teléfono es obligatorio) y el diálogo lo avisa antes de registrar. Un 409 (el
 * correo o el teléfono ya existen) ofrece buscarlo.
 */
export function RegistrarClienteDialog({
  inicial,
  textoBoton = "Registrar cliente",
  onCerrar,
  onRegistrado,
  onBuscar,
}: {
  inicial?: { email?: string; telefono?: string };
  textoBoton?: string;
  onCerrar: () => void;
  onRegistrado: (registro: ClienteRegistrado) => void;
  /** Al 409: buscar al cliente que ya existe con ese correo o teléfono. */
  onBuscar?: (valor: string) => void;
}) {
  const negocio = useNegocioActivo();
  const registrar = useRegistrarCliente(negocio.id_negocio);
  const [conflicto, setConflicto] = useState<{ mensaje: string; valor: string } | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const form = useForm<RegistroValores>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: inicial?.email ?? "",
      telefono: inicial?.telefono ?? "",
      mascota: mascotaVacia(),
      autoriza: false,
    },
  });
  const email = useWatch({ control: form.control, name: "email" });
  const sinCorreo = email.trim() === "";
  const { errors } = form.formState;

  const enviar = form.handleSubmit((valores) => {
    setConflicto(null);
    setErrorGeneral(null);
    registrar.mutate(registroAApi(valores), {
      onSuccess: onRegistrado,
      onError: (error) => {
        if (error.status === 409) {
          setConflicto({
            mensaje: error.message,
            valor: error.errors.email ? valores.email : valores.telefono,
          });
          return;
        }
        if (!aplicarErroresApi(form.setError, error, CAMPOS_REGISTRO)) setErrorGeneral(error.message);
      },
    });
  });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[680px] overflow-y-auto">
        <DialogTitle>Registrar cliente sin app</DialogTitle>
        <DialogDescription className="mt-1">
          Para clientes que llegan al mostrador o llaman. Con correo, luego podrá activar su cuenta y usar la
          app.
        </DialogDescription>
        <form onSubmit={(e) => void enviar(e)} className="mt-4 flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-label font-semibold text-muted uppercase">Datos del cliente</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Nombre *" error={errors.nombre?.message}>
                <Input autoComplete="off" {...form.register("nombre")} />
              </Field>
              <Field label="Apellido *" error={errors.apellido?.message}>
                <Input autoComplete="off" {...form.register("apellido")} />
              </Field>
              <Field
                label="Correo electrónico"
                error={errors.email?.message}
                ayuda="Opcional: sin correo no tendrá cuenta"
              >
                <Input type="email" autoComplete="off" {...form.register("email")} />
              </Field>
              <Field label={sinCorreo ? "Teléfono *" : "Teléfono"} error={errors.telefono?.message}>
                <Input type="tel" autoComplete="off" {...form.register("telefono")} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-label font-semibold text-muted uppercase">Primera mascota</legend>
            <CamposMascota
              control={form.control}
              register={form.register}
              errores={errors.mascota}
              prefijo="mascota."
            />
          </fieldset>

          <Controller
            control={form.control}
            name="autoriza"
            render={({ field }) => (
              <div className="rounded-control bg-surface p-3">
                <label className="flex items-start gap-3 text-body text-ink">
                  <Checkbox
                    className="mt-0.5"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={errors.autoriza ? true : undefined}
                  />
                  <span>
                    El cliente autoriza el tratamiento de sus datos personales según la política de PetCat
                    (Ley 1581 de 2012). Se registrará la fecha y quién tomó la autorización. *
                  </span>
                </label>
                {errors.autoriza && <p className="mt-1 text-label text-danger">{errors.autoriza.message}</p>}
              </div>
            )}
          />

          {sinCorreo ? (
            <Alert tono="advertencia" className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Sin correo quedará como <strong>cliente sin cuenta</strong>: no recibirá correos ni
                recordatorios y no podrá entrar a la app. Lo encontrarás por su teléfono.
              </span>
            </Alert>
          ) : (
            <Alert tono="info" className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Le enviaremos un correo de bienvenida de {negocio.nombre} con un enlace para crear su
                contraseña (válido 7 días).
              </span>
            </Alert>
          )}

          {conflicto && (
            <Alert tono="advertencia">
              {conflicto.mensaje}
              {onBuscar && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="ml-2"
                  onClick={() => onBuscar(conflicto.valor)}
                >
                  Buscarlo
                </Button>
              )}
            </Alert>
          )}
          {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" cargando={registrar.isPending}>
              {textoBoton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
