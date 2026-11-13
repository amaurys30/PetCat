import { ChevronDown, Smartphone, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { contenedor, etiquetaSeccion, textoSeccion, tituloSeccion } from "../estilos";
import type { Pregunta } from "../textos";
import { Aparecer } from "./Aparecer";

/** Sección amplia con su encabezado (etiqueta, título y bajada) y el contenido debajo. */
export function Seccion({
  id,
  etiqueta,
  titulo,
  descripcion,
  children,
  className,
}: {
  id?: string;
  etiqueta?: string;
  titulo: string;
  descripcion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const idTitulo = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={idTitulo} className={cn("py-16 sm:py-24", className)}>
      <Aparecer className={contenedor}>
        <div className="mx-auto max-w-2xl text-center">
          {etiqueta && <p className={etiquetaSeccion}>{etiqueta}</p>}
          <h2 id={idTitulo} className={cn(tituloSeccion, etiqueta && "mt-4")}>
            {titulo}
          </h2>
          {descripcion && <p className={cn(textoSeccion, "mt-4")}>{descripcion}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </Aparecer>
    </section>
  );
}

export interface Beneficio {
  icono: LucideIcon;
  titulo: string;
  texto: string;
  /** Fondo y color del ícono. */
  tono: "teal" | "naranja" | "lila" | "azul";
}

const TONOS: Record<Beneficio["tono"], string> = {
  teal: "bg-primary-soft text-primary-deep",
  naranja: "bg-warning-soft text-warning-ink",
  lila: "bg-done-soft text-done",
  azul: "bg-info-soft text-info",
};

export function TarjetasBeneficios({ beneficios }: { beneficios: Beneficio[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {beneficios.map((b) => (
        <li
          key={b.titulo}
          className="flex flex-col gap-4 rounded-card border border-border bg-white p-6 transition-shadow lg:last:[&:nth-child(3n+1)]:col-span-3 hover:shadow-[0_12px_32px_rgb(30_42_59/0.08)]"
        >
          <span className={cn("flex size-12 items-center justify-center rounded-card", TONOS[b.tono])}>
            <b.icono className="size-6" aria-hidden />
          </span>
          <h3 className="text-[18px] leading-6 font-bold text-ink">{b.titulo}</h3>
          <p className="text-[15px] leading-6 text-muted">{b.texto}</p>
        </li>
      ))}
    </ul>
  );
}

export function Pasos({ pasos }: { pasos: { titulo: string; texto: string }[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {pasos.map((p, i) => (
        <li key={p.titulo} className="relative flex flex-col gap-3 rounded-modal bg-white p-7 shadow-[0_1px_2px_rgb(30_42_59/0.06)]">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-dark text-[20px] font-bold text-white">
            {i + 1}
          </span>
          <h3 className="mt-2 text-[19px] leading-7 font-bold text-ink">{p.titulo}</h3>
          <p className="text-[15px] leading-6 text-muted">{p.texto}</p>
        </li>
      ))}
    </ol>
  );
}

export function PreguntasFrecuentes({ preguntas }: { preguntas: Pregunta[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {preguntas.map((p) => (
        <details key={p.pregunta} className="group rounded-card border border-border bg-white open:shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-left text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {p.pregunta}
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-6 text-muted">{p.respuesta}</p>
        </details>
      ))}
    </div>
  );
}

/** Google Play y App Store, sin enlace hasta que salga la app. */
export function BotonesTiendas() {
  return (
    <ul className="flex flex-wrap gap-3" aria-label="Descargar la app">
      {["Google Play", "App Store"].map((tienda) => (
        <li key={tienda} className="flex items-center gap-3 rounded-card border border-border bg-white px-4 py-2.5 text-ink">
          <Smartphone className="size-6 shrink-0" aria-hidden />
          <span className="flex flex-col leading-tight">
            <span className="text-[12px] text-muted">Próximamente en</span>
            <span className="text-[15px] font-semibold">{tienda}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
