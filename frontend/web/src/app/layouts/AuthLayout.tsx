import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { SaltarAlContenido } from "@/components/common/SaltarAlContenido";

const VENTAJAS = [
  "Reservas desde la app, sin llamadas",
  "Recordatorios automáticos a tus clientes",
  "Historial y carnet de vacunas digital",
];

/** Pantallas de acceso: panel de marca con degradado a la izquierda y tarjeta a la derecha. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      <SaltarAlContenido />
      <aside className="flex w-[560px] shrink-0 flex-col justify-between bg-marca px-14 py-14 text-white">
        <Logo claro />
        <div>
          <h1 className="text-[34px] leading-[42px] font-bold">Tu negocio de mascotas, organizado.</h1>
          <p className="mt-4 text-[15px] leading-[21px] text-white/85">
            Agenda, clientes, historial médico, recordatorios y reseñas en un solo panel.
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {VENTAJAS.map((v) => (
              <li key={v} className="flex items-center gap-3 text-[14px] font-medium">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/15">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {v}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-label text-white/75">© 2026 PetCat · Sincelejo, Sucre</p>
      </aside>
      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center p-10 focus:outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}

/** Tarjeta blanca del formulario de acceso. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("w-[420px] rounded-card border bg-white p-8 shadow-card", className)}>
      {children}
    </section>
  );
}

export function AuthTitulo({ titulo, descripcion }: { titulo: string; descripcion?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-[22px] leading-7 font-bold text-ink">{titulo}</h1>
      {descripcion && <p className="mt-2 text-body text-muted">{descripcion}</p>}
    </header>
  );
}
