import { useState } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useNegocioGlobal, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { puedeActivarPrueba } from "@/lib/permisos";
import { useAuth } from "@/stores/auth";
import { usePruebaPro } from "../hooks/usePruebaPro";

/** Confirmación de la prueba Pro: qué incluye, que se usa una vez y qué pasa al terminar. */
export function ConfirmarPruebaPro({
  idNegocio,
  abierto,
  onAbiertoChange,
  onActivada,
}: {
  idNegocio: number;
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  onActivada?: () => void;
}) {
  const prueba = usePruebaPro(idNegocio);
  const activar = () =>
    prueba.mutate(undefined, {
      onSuccess: () => {
        onAbiertoChange(false);
        onActivada?.();
      },
      onError: () => onAbiertoChange(false),
    });
  return (
    <ConfirmDialog
      abierto={abierto}
      onAbiertoChange={onAbiertoChange}
      titulo="¿Activar la prueba del plan Pro?"
      descripcion="Durante 14 días tendrás todo lo del plan Pro: más sedes, citas, empleados y productos ilimitados y las estadísticas avanzadas. La prueba se usa una sola vez. Al terminar, el negocio vuelve al plan Gratuito sin que se desactive nada: solo vuelven a aplicar sus límites."
      confirmar="Activar prueba"
      cargando={prueba.isPending}
      onConfirmar={activar}
    />
  );
}

/**
 * Invitación a Pro (dashboard bloqueado, límite del plan): "Probar Pro 14 días" si el
 * negocio puede usar la prueba y quien mira es el propietario, y "Ver planes" para quien
 * puede ver la suscripción. Fuera de las rutas del panel usa el negocio del store.
 */
export function BotonesPlan({ alElegir }: { alElegir?: () => void }) {
  const { idNegocio, negocio, puede } = useNegocioGlobal();
  const usuario = useAuth((s) => s.usuario);
  const verSuscripcion = puede("configuracion", "ver");
  const suscripcion = useSuscripcion(idNegocio ?? 0, verSuscripcion && idNegocio !== null);
  const [confirmar, setConfirmar] = useState(false);
  if (!idNegocio) return null;

  const probar = suscripcion.data?.prueba_disponible === true && puedeActivarPrueba(usuario, negocio);
  if (!verSuscripcion) {
    return <p className="text-body text-muted">El propietario del negocio puede mejorar el plan.</p>;
  }
  return (
    <>
      {probar && <Button onClick={() => setConfirmar(true)}>Probar Pro 14 días</Button>}
      <Button asChild variant={probar ? "secondary" : "primary"} onClick={alElegir}>
        <Link to={`/n/${idNegocio}/suscripcion`}>Ver planes</Link>
      </Button>
      <ConfirmarPruebaPro
        idNegocio={idNegocio}
        abierto={confirmar}
        onAbiertoChange={setConfirmar}
        onActivada={alElegir}
      />
    </>
  );
}
