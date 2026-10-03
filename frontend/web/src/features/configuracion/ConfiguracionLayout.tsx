import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, type To } from "react-router";
import { Cargando, SinPermiso } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGestion } from "@/features/negocios/hooks/useGestion";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { cn } from "@/lib/utils";
import { useConfiguracion, type ContextoConfiguracion } from "./contexto";

const PESTANAS: { ruta: To; titulo: string }[] = [
  { ruta: "resumen", titulo: "Resumen" },
  { ruta: "perfil", titulo: "Perfil del negocio" },
  { ruta: "sedes", titulo: "Sedes y horarios" },
];

/**
 * /n/:id/configuracion: pestañas Resumen (E0), Perfil del negocio (E1) y Sedes y horarios (E2).
 * Requiere configuracion.ver. Carga una vez `GET /negocios/:id/gestion` para las tres.
 */
export function ConfiguracionLayout() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const puedeVer = puede("configuracion", "ver");
  const gestion = useGestion(negocio.id_negocio, puedeVer);
  const [destinoAcciones, setDestinoAcciones] = useState<HTMLElement | null>(null);

  if (!puedeVer) {
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
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <nav
          aria-label="Secciones de configuración"
          className="inline-flex gap-1 rounded-control bg-track p-1"
        >
          {PESTANAS.map((p) => (
            <NavLink
              key={p.titulo}
              to={p.ruta}
              className={({ isActive }) =>
                cn(
                  "flex h-8 items-center rounded-[6px] px-3 text-body font-medium transition-colors",
                  isActive ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink",
                )
              }
            >
              {p.titulo}
            </NavLink>
          ))}
        </nav>
        <div ref={setDestinoAcciones} className="flex items-center gap-2" />
      </div>
      {gestion.isError ? (
        <Card>
          <ErrorConsulta error={gestion.error} reintentar={() => void gestion.refetch()} />
        </Card>
      ) : !gestion.data ? (
        <Card>
          <Cargando lineas={6} />
        </Card>
      ) : (
        <Outlet
          context={
            {
              negocio: gestion.data,
              puedeEditar: puede("configuracion", "editar"),
              destinoAcciones,
            } satisfies ContextoConfiguracion
          }
        />
      )}
    </div>
  );
}

/** Botones de la pestaña, a la derecha de las pestañas. */
export function AccionesConfiguracion({ children }: { children: React.ReactNode }) {
  const { destinoAcciones } = useConfiguracion();
  return destinoAcciones ? createPortal(children, destinoAcciones) : null;
}
