import { Building2, ChevronsUpDown, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { Avatar } from "@/components/common/Avatar";
import { Logo } from "@/components/common/Logo";
import { NoEncontrado } from "@/components/common/EstadoPantalla";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fechaLargaTitulo, hoyISO } from "@/lib/format";
import { useAuth } from "@/stores/auth";

/**
 * Administración de PetCat (`/admin`): solo el super admin (`tipo_usuario = admin`), que puede
 * no tener negocios. Para cualquier otro usuario la ruta no existe. Sin la campana: depende
 * del negocio activo y el admin no recibe notificaciones del panel por serlo.
 */
export function AdminLayout() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  if (!usuario) return null;
  if (usuario.tipo_usuario !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <Card className="w-full max-w-lg">
          <NoEncontrado
            acciones={
              <Button asChild variant="secondary">
                <Link to="/">Ir al inicio</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  const nombre = `${usuario.nombre} ${usuario.apellido}`;

  return (
    <div className="flex min-h-screen min-w-[1280px] bg-surface">
      <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r bg-white">
        <div className="px-4 pt-5 pb-3">
          <Logo />
        </div>
        <div className="px-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-control border p-2.5 text-left hover:bg-surface">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">Administración</span>
                <span className="block truncate text-label text-muted">Super admin de PetCat</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
              <span className="sr-only">Cambiar a un negocio</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Tus negocios</DropdownMenuLabel>
              {usuario.negocios.length === 0 ? (
                <p className="px-2 py-1.5 text-label text-muted">No trabajas en ningún negocio.</p>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/negocios">
                    <LayoutGrid /> Ir a mis negocios
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav aria-label="Administración" className="mt-2 flex-1 px-3">
          <p className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
            Plataforma
          </p>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[14px] font-medium ${
                isActive ? "bg-primary-soft text-primary-dark" : "text-ink hover:bg-surface"
              }`
            }
          >
            <Building2 className="size-4" aria-hidden /> Negocios y planes
          </NavLink>
        </nav>
        <div className="flex items-center gap-2.5 border-t px-4 py-3">
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
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-title font-bold text-ink">Administración PetCat</h1>
            <p className="truncate text-body text-muted">
              {fechaLargaTitulo(hoyISO())} · Solo super admin · negocios y suscripciones
            </p>
          </div>
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
              <DropdownMenuItem onSelect={() => void salir()}>
                <LogOut /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
