import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useOutletContext } from "react-router";
import { SinPermiso } from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePuede } from "@/features/negocios/hooks/useNegocio";
import { cn } from "@/lib/utils";

interface ContextoEquipo {
  destinoAcciones: HTMLElement | null;
}

/**
 * /n/:id/equipo: pestañas Miembros (D3) y Roles y permisos (D4). Requiere empleados.ver;
 * la pestaña de roles, roles.ver.
 */
export function EquipoLayout() {
  const puede = usePuede();
  const [destinoAcciones, setDestinoAcciones] = useState<HTMLElement | null>(null);

  if (!puede("empleados", "ver")) {
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

  const pestanas = [
    { ruta: "miembros", titulo: "Miembros" },
    ...(puede("roles", "ver") ? [{ ruta: "roles", titulo: "Roles y permisos" }] : []),
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <nav aria-label="Secciones de equipo" className="inline-flex gap-1 rounded-control bg-track p-1">
          {pestanas.map((p) => (
            <NavLink
              key={p.ruta}
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
      <Outlet context={{ destinoAcciones } satisfies ContextoEquipo} />
    </div>
  );
}

/** Botones de la pestaña, a la derecha de las pestañas. */
export function AccionesEquipo({ children }: { children: React.ReactNode }) {
  const { destinoAcciones } = useOutletContext<ContextoEquipo>();
  return destinoAcciones ? createPortal(children, destinoAcciones) : null;
}
