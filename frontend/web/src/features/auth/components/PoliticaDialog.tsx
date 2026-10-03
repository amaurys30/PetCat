import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/field";
import { useAuth } from "@/stores/auth";
import { useAceptarPolitica } from "../hooks/useAuthMutations";

/**
 * A9 · Aceptar política de datos (bloqueante). Aparece sobre cualquier pantalla con
 * sesión cuando `GET /auth/me` trae `requiere_aceptar_politica`. No se cierra sin
 * aceptar; la alternativa es cerrar sesión.
 */
export function PoliticaDialog() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  const aceptar = useAceptarPolitica();
  const [acepta, setAcepta] = useState(false);

  if (!usuario?.requiere_aceptar_politica) return null;
  const { version, url } = usuario.politica;

  return (
    <Dialog open>
      <DialogContent cerrable={false} className="max-w-[520px]">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <DialogTitle>Actualizamos nuestra política de datos</DialogTitle>
        <DialogDescription className="mt-2">
          Para seguir usando PetCat necesitamos que aceptes la versión {version} de la política de tratamiento
          de datos personales (Ley 1581 de 2012).
        </DialogDescription>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-body font-semibold text-primary hover:underline"
          >
            Leer la política completa →
          </a>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Checkbox id="acepta-politica" checked={acepta} onCheckedChange={(v) => setAcepta(v === true)} />
          <Label htmlFor="acepta-politica" className="text-body font-normal text-ink">
            He leído y acepto la política de tratamiento de datos.
          </Label>
        </div>

        {aceptar.isError && (
          <Alert tono="error" className="mt-4">
            {aceptar.error.message}
          </Alert>
        )}

        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={!acepta}
          cargando={aceptar.isPending}
          onClick={() => aceptar.mutate()}
        >
          Aceptar y continuar
        </Button>
        <p className="mt-3 text-label text-subtle">
          No se puede cerrar sin aceptar. Si no estás de acuerdo, puedes{" "}
          <button type="button" onClick={() => void salir()} className="font-semibold text-muted underline">
            cerrar sesión
          </button>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
