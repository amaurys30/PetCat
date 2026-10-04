import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { Empleado, EmpleadoPropioBody } from "@/api/empleados";
import { toApiError } from "@/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi, sinVacios } from "@/lib/forms";
import { useAuth } from "@/stores/auth";
import { useRegistrarme, useRoles } from "../hooks/useEquipo";
import { agregarmeSchema, type AgregarmeValores } from "../schemas";

const CAMPOS = ["id_rol", "telefono", "especialidad", "titulo_profesional", "registro_profesional"] as const;

/**
 * "Agregarme como profesional" (POST .../empleados/yo). Solo el propietario: queda como
 * miembro del equipo para aparecer en la agenda. No cuenta para el límite del plan.
 */
export function AgregarmeDialog({ onCerrar }: { onCerrar: () => void }) {
  const negocio = useNegocioActivo();
  const usuario = useAuth((s) => s.usuario);
  const roles = useRoles(negocio.id_negocio);
  const registrarme = useRegistrarme();
  const [listo, setListo] = useState<{ empleado: Empleado; mensaje: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const administrador = roles.data?.find((r) => r.es_sistema && r.nombre === "Administrador");

  const form = useForm<AgregarmeValores>({
    resolver: zodResolver(agregarmeSchema),
    values: {
      id_rol: administrador?.id_rol ?? 0,
      telefono: usuario?.telefono ?? "",
      especialidad: "",
      titulo_profesional: "",
      registro_profesional: "",
    },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (valores) => {
    setError(null);
    try {
      const { data, message } = await registrarme.mutateAsync(sinVacios(valores) as EmpleadoPropioBody);
      setListo({ empleado: data, mensaje: message });
    } catch (e) {
      const apiError = toApiError(e);
      if (!aplicarErroresApi(form.setError, apiError, CAMPOS)) setError(apiError.message);
    }
  });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !isSubmitting && onCerrar()}>
      <DialogContent className="max-w-[560px]">
        {listo ? (
          <>
            <DialogTitle>Ya eres parte del equipo</DialogTitle>
            <DialogDescription className="mt-2">
              {listo.mensaje}. Apareces en la agenda y puedes atender citas. Configura tu disponibilidad o
              asígnate servicios cuando quieras.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCerrar}>
                Más tarde
              </Button>
              <Button asChild>
                <Link to={`../${listo.empleado.id_empleado}/disponibilidad`}>Configurar mi disponibilidad</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Agregarme como profesional</DialogTitle>
            <DialogDescription className="mt-2">
              Para atender citas tú también. Tu nombre y correo salen de tu cuenta. No cuentas para el límite
              de empleados de tu plan.
            </DialogDescription>
            <form onSubmit={onSubmit} noValidate className="mt-4">
              <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rol" error={errors.id_rol?.message} ayuda="Como propietario tienes acceso total igual.">
                    <NativeSelect {...form.register("id_rol", { valueAsNumber: true })}>
                      {roles.data?.map((r) => (
                        <option key={r.id_rol} value={r.id_rol}>
                          {r.nombre}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Teléfono" error={errors.telefono?.message}>
                    <Input type="tel" {...form.register("telefono")} />
                  </Field>
                  <Field label="Especialidad" error={errors.especialidad?.message}>
                    <Input placeholder="Medicina de pequeños animales" {...form.register("especialidad")} />
                  </Field>
                  <Field label="Título profesional" error={errors.titulo_profesional?.message}>
                    <Input {...form.register("titulo_profesional")} />
                  </Field>
                  <Field label="Registro profesional" error={errors.registro_profesional?.message}>
                    <Input {...form.register("registro_profesional")} />
                  </Field>
                </div>
                {error && <Alert tono="error">{error}</Alert>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={onCerrar}>
                    Cancelar
                  </Button>
                  <Button type="submit" cargando={isSubmitting} disabled={!roles.data}>
                    Agregarme
                  </Button>
                </div>
              </fieldset>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
