import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { GRUPOS_MENU, PROXIMAMENTE } from "@/app/menu";
import { Avatar } from "@/components/common/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/common/Logo";
import { useAtencion } from "@/features/agenda/hooks/useAgenda";
import { useNegocioActivo, usePuede, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { puedeActivarPrueba } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import { rolEnNegocio } from "@/features/negocios/textos";
import { useAuth } from "@/stores/auth";

/** Menú lateral (Figma Panel/Sidebar). */
export function Sidebar() {
  const puede = usePuede();
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r bg-white">
      <div className="px-4 pt-5 pb-3">
        <Logo />
      </div>
      <div className="px-3">
        <SelectorNegocio />
      </div>
      <nav aria-label="Secciones del negocio" className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
        {GRUPOS_MENU.map((grupo) => {
          const visibles = grupo.secciones.filter((s) => puede(...s.permiso));
          if (visibles.length === 0) return null;
          return (
            <div key={grupo.titulo} className="mt-3">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
                {grupo.titulo}
              </p>
              <ul className="flex flex-col gap-0.5">
                {visibles.map((s) => (
                  <li key={s.ruta}>
                    <NavLink
                      to={s.ruta}
                      className={({ isActive }) =>
                        cn(
                          "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[14px] font-medium transition-colors",
                          isActive ? "bg-primary-soft text-primary-dark" : "text-ink hover:bg-surface",
                        )
                      }
                    >
                      <s.icono className="size-4 shrink-0" aria-hidden />
                      {s.titulo}
                      {s.ruta === "agenda" && <PorConfirmar />}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="mt-3">
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
            Próximamente
          </p>
          {PROXIMAMENTE.map((p) => (
            <div
              key={p.titulo}
              aria-disabled
              className="flex h-9 items-center gap-2.5 px-2.5 text-[14px] font-medium text-subtle"
            >
              <p.icono className="size-4" aria-hidden />
              {p.titulo}
              <span className="ml-auto rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold">
                {p.etiqueta}
              </span>
            </div>
          ))}
        </div>
      </nav>
      <div className="flex flex-col gap-3 px-3 pb-4">
        <TarjetaPlan />
        <Usuario />
      </div>
    </aside>
  );
}

/** Número de citas por confirmar en el menú (todas las del negocio desde hoy). */
function PorConfirmar() {
  const negocio = useNegocioActivo();
  const { data } = useAtencion(negocio.id_negocio, {});
  const n = data?.por_confirmar.length ?? 0;
  if (n === 0) return null;
  return (
    <span
      className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-white"
      aria-label={`${n} por confirmar`}
    >
      {n}
    </span>
  );
}

function SelectorNegocio() {
  const negocio = useNegocioActivo();
  const negocios = useAuth((s) => s.usuario?.negocios ?? []);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Conserva la sección (/n/1/agenda/... -> /n/2/agenda), sin los ids del negocio anterior.
  const cambiarA = (id: number) => {
    const seccion = pathname.split("/")[3];
    navigate(seccion ? `/n/${id}/${seccion}` : `/n/${id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-control border p-2.5 text-left hover:bg-surface">
        <Avatar nombre={negocio.nombre} fotoUrl={negocio.logo_miniatura_url} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{negocio.nombre}</span>
          <span className="block truncate text-label text-muted">
            {negocio.ciudad} · {rolEnNegocio(negocio)}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
        <span className="sr-only">Cambiar de negocio</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Tus negocios</DropdownMenuLabel>
        {negocios.map((n) => (
          <DropdownMenuItem key={n.id_negocio} onSelect={() => cambiarA(n.id_negocio)}>
            <Avatar nombre={n.nombre} fotoUrl={n.logo_miniatura_url} tamano="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{n.nombre}</span>
              <span className="block truncate text-label text-muted">{rolEnNegocio(n)}</span>
            </span>
            {n.id_negocio === negocio.id_negocio && (
              <Check className="text-primary!" aria-label="Negocio actual" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/negocios">
            <LayoutGrid /> Ver todos mis negocios
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TarjetaPlan() {
  const negocio = useNegocioActivo();
  const usuario = useAuth((s) => s.usuario);
  const puede = usePuede();
  const verSuscripcion = puede("configuracion", "ver");
  const { data } = useSuscripcion(negocio.id_negocio, verSuscripcion);

  const { nombre, en_prueba } = negocio.plan;
  const citas = data?.uso.citas_mes;
  const conLimite = citas && citas.maximo !== -1;
  const dias = data?.suscripcion?.dias_prueba_restantes;

  let detalle = "Citas, sedes y empleados ilimitados";
  if (en_prueba && dias != null)
    detalle = `Prueba Pro: ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`}`;
  else if (conLimite) detalle = `${citas.usadas} de ${citas.maximo} citas este mes`;
  else if (nombre === "Gratuito") detalle = "1 sede, 30 citas al mes y 3 empleados";

  return (
    <div className="rounded-card border border-primary/20 bg-selected p-3">
      <p className="text-body font-semibold text-ink">Plan {nombre}</p>
      <p className="mt-1 text-label text-muted">{detalle}</p>
      {conLimite && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-label="Citas usadas este mes"
          aria-valuemin={0}
          aria-valuemax={citas.maximo}
          aria-valuenow={citas.usadas}
        >
          <div
            className={cn("h-full rounded-full", citas.usadas >= citas.maximo ? "bg-danger" : "bg-primary")}
            style={{ width: `${Math.min(100, (citas.usadas / citas.maximo) * 100)}%` }}
          />
        </div>
      )}
      {verSuscripcion && (
        <Link
          to="suscripcion"
          className="mt-2 inline-block text-label font-semibold text-primary hover:underline"
        >
          {data?.prueba_disponible && puedeActivarPrueba(usuario, negocio)
            ? "Probar Pro 14 días →"
            : "Ver suscripción →"}
        </Link>
      )}
    </div>
  );
}

function Usuario() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  if (!usuario) return null;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Avatar nombre={nombre} fotoUrl={usuario.foto_miniatura_url} tono="suave" />
      <div className="min-w-0">
        <p className="truncate text-body font-semibold text-ink">{nombre}</p>
        <button
          type="button"
          onClick={() => void salir()}
          className="text-label text-muted hover:text-danger"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
