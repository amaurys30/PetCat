import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Mascota } from "@/api/clientes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { aplicarErroresApi } from "@/lib/forms";
import { useAgregarMascota } from "../hooks/useClientes";
import { mascotaAApi, mascotaSchema, mascotaVacia, type MascotaValores } from "../schemas";
import { CamposMascota } from "./CamposMascota";

/**
 * Registrar otra mascota de un cliente (C6, desde B5). La API exige que el cliente ya
 * tenga relación con el negocio (una cita o haberlo registrado aquí): si no, 403 y se
 * explica que primero se agenda con una de sus mascotas.
 */
export function AgregarMascotaDialog({
  idUsuario,
  nombreCliente,
  onCerrar,
  onAgregada,
}: {
  idUsuario: number;
  nombreCliente: string;
  onCerrar: () => void;
  onAgregada: (mascota: Mascota) => void;
}) {
  const negocio = useNegocioActivo();
  const agregar = useAgregarMascota(negocio.id_negocio);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<MascotaValores>({
    resolver: zodResolver(mascotaSchema),
    defaultValues: mascotaVacia(),
  });

  const enviar = form.handleSubmit((valores) => {
    setError(null);
    agregar.mutate(
      { idUsuario, ...mascotaAApi(valores) },
      {
        onSuccess: onAgregada,
        onError: (e) => {
          if (e.status === 403 && !e.limitePlan) {
            setError(
              `${nombreCliente} todavía no es cliente de ${negocio.nombre}. Agenda primero con una de sus mascotas y después podrás registrarle otra.`,
            );
            return;
          }
          if (
            !aplicarErroresApi(form.setError, e, [
              "nombre",
              "especie",
              "raza",
              "sexo",
              "fecha_nacimiento",
              "peso",
            ])
          ) {
            setError(e.message);
          }
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto">
        <DialogTitle>Nueva mascota</DialogTitle>
        <DialogDescription className="mt-1">Queda a nombre de {nombreCliente}.</DialogDescription>
        <form onSubmit={(e) => void enviar(e)} className="mt-4 flex flex-col gap-4" noValidate>
          <CamposMascota
            control={form.control}
            register={form.register}
            errores={form.formState.errors}
            prefijo=""
          />
          {error && <Alert tono="error">{error}</Alert>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" cargando={agregar.isPending}>
              Registrar mascota
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
