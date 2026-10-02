import { Construction } from "lucide-react";
import { Link } from "react-router";
import type { Seccion } from "@/app/menu";
import { EstadoPantalla, SinPermiso } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePuede } from "@/features/negocios/hooks/useNegocio";

/** Sección del menú que todavía no se construye. Respeta el permiso igual que la sección real. */
export function SeccionPendiente({ seccion }: { seccion: Seccion }) {
  const puede = usePuede();
  if (!puede(...seccion.permiso)) {
    return (
      <Card>
        <SinPermiso
          acciones={
            <Button asChild variant="secondary">
              <Link to="..">Volver al inicio</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <EstadoPantalla
        icono={Construction}
        tono="primary"
        titulo={`${seccion.titulo} está en construcción`}
        descripcion={`Esta sección llega en la fase ${seccion.fase} del panel.`}
      />
    </Card>
  );
}
