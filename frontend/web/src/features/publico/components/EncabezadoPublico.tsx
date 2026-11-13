import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { botonPrimario, contenedor } from "../estilos";

export interface EnlaceSeccion {
  href: `#${string}`;
  texto: string;
}

interface Props {
  secciones: EnlaceSeccion[];
  /** Enlace a la otra página pública ("¿Tienes una veterinaria?" o "¿Tienes una mascota?"). */
  otraPagina: { to: string; texto: string };
}

/**
 * Encabezado fijo de las páginas públicas. Con sesión, "Ir al panel" en lugar de "Iniciar
 * sesión". En celular, los enlaces van en un menú desplegable.
 */
export function EncabezadoPublico({ secciones, otraPagina }: Props) {
  const usuario = useAuth((s) => s.usuario);
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const cerrar = () => setAbierto(false);
  const acceso = usuario ? { to: "/panel", texto: "Ir al panel" } : { to: "/login", texto: "Iniciar sesión" };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur">
      <div className={cn(contenedor, "flex h-16 items-center justify-between gap-4 lg:h-[72px]")}>
        <Link to="/" aria-label="PetCat, inicio" className="rounded-control" onClick={cerrar}>
          <Logo />
        </Link>

        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {secciones.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="rounded-control px-3 py-2 text-[15px] font-medium text-ink hover:bg-surface"
                >
                  {s.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to={otraPagina.to}
            className="rounded-control px-3 py-2 text-[15px] font-semibold text-primary-deep hover:bg-primary-soft"
          >
            {otraPagina.texto}
          </Link>
          <Link to={acceso.to} className={cn(botonPrimario, "h-11 rounded-control px-5")}>
            {acceso.texto}
          </Link>
        </div>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-control text-ink hover:bg-surface lg:hidden"
          aria-expanded={abierto}
          aria-controls={idMenu}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </div>

      <div id={idMenu} hidden={!abierto} className="border-t border-border bg-white lg:hidden">
        <nav aria-label="Menú" className={cn(contenedor, "flex flex-col gap-1 py-4")}>
          {secciones.map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={cerrar}
              className="rounded-control px-3 py-3 text-[16px] font-medium text-ink hover:bg-surface"
            >
              {s.texto}
            </a>
          ))}
          <Link
            to={otraPagina.to}
            onClick={cerrar}
            className="rounded-control px-3 py-3 text-[16px] font-semibold text-primary-deep hover:bg-primary-soft"
          >
            {otraPagina.texto}
          </Link>
          <Link to={acceso.to} onClick={cerrar} className={cn(botonPrimario, "mt-2 w-full")}>
            {acceso.texto}
          </Link>
        </nav>
      </div>
    </header>
  );
}
