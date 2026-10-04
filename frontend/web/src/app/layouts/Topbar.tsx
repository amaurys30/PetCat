import { Bell, LayoutGrid, LogOut, Search, UserRound } from "lucide-react";
import { Link, useMatches } from "react-router";
import { Avatar } from "@/components/common/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { fechaLargaTitulo, hoyISO } from "@/lib/format";
import { useAuth } from "@/stores/auth";

export interface HandleRuta {
  titulo?: string;
}

/** Barra superior (Figma Panel/Topbar): título de la sección, fecha, búsqueda, avisos y usuario. */
export function Topbar() {
  const negocio = useNegocioActivo();
  const matches = useMatches();
  const titulo = [...matches].reverse().find((m) => (m.handle as HandleRuta | undefined)?.titulo)?.handle as
    HandleRuta | undefined;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-title font-bold text-ink">{titulo?.titulo ?? negocio.nombre}</h1>
        <p className="truncate text-body text-muted">
          {fechaLargaTitulo(hoyISO())} · {negocio.nombre}
        </p>
      </div>
      <Tooltip texto="La búsqueda llega con Clientes (P5)">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            disabled
            aria-label="Buscar cliente, mascota o cita"
            placeholder="Buscar cliente, mascota o cita…"
            className="h-9 w-full rounded-control border-0 bg-surface pr-3 pl-9 text-body placeholder:text-subtle"
          />
        </div>
      </Tooltip>
      <Tooltip texto="Las notificaciones llegan en P6">
        <span>
          <button
            type="button"
            disabled
            aria-label="Notificaciones"
            className="flex size-9 items-center justify-center rounded-control text-muted disabled:opacity-60"
          >
            <Bell className="size-5" />
          </button>
        </span>
      </Tooltip>
      <MenuUsuario />
    </header>
  );
}

function MenuUsuario() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  if (!usuario) return null;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Menú de usuario">
        <Avatar nombre={nombre} fotoUrl={usuario.foto_miniatura_url} tono="suave" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="normal-case">
          <span className="block text-body text-ink">{nombre}</span>
          <span className="block font-normal text-muted">{usuario.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="mi-perfil">
            <UserRound /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/negocios">
            <LayoutGrid /> Cambiar de negocio
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void salir()}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
