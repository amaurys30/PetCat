import { BadgeCheck, CalendarCheck, MapPin, Quote, Star, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEstadisticas, useResenasDestacadas } from "../hooks/usePublico";
import { textoMes, textoNumero } from "../textos";
import { Seccion } from "./Secciones";

/*
 * Secciones con datos de la API. Ninguna inventa números: lo que la API no manda (cifras bajo
 * el umbral, pocas reseñas) no se muestra.
 */

const CIFRAS = [
  { clave: "negocios_activos", icono: Store, texto: "negocios activos" },
  { clave: "ciudades", icono: MapPin, texto: "ciudades" },
  { clave: "citas_atendidas", icono: CalendarCheck, texto: "citas atendidas" },
] as const;

/** Cifras de la plataforma: cada una solo si la API la manda (supera el umbral). */
export function Cifras() {
  const { data } = useEstadisticas();
  const visibles = CIFRAS.flatMap((c) => {
    const valor = data?.[c.clave];
    return typeof valor === "number" ? [{ ...c, valor }] : [];
  });
  if (visibles.length === 0) return null;

  return (
    <section aria-labelledby="cifras-titulo" className="bg-marca-oscura py-14 text-white sm:py-16">
      <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6 lg:px-8">
        <h2 id="cifras-titulo" className="text-center text-[22px] font-bold sm:text-[26px]">
          PetCat en cifras
        </h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-5">
          {visibles.map((c) => (
            <li
              key={c.clave}
              className="flex min-w-[220px] flex-1 basis-[220px] flex-col items-center gap-2 rounded-modal border border-white/30 px-6 py-7 text-center sm:max-w-[320px]"
            >
              <c.icono className="size-7 text-white" aria-hidden />
              <span className="text-[40px] leading-[48px] font-bold">{textoNumero(c.valor)}</span>
              <span className="text-[16px] text-white">{c.texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Estrellas({ calificacion }: { calificacion: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${calificacion} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-5", i < calificacion ? "fill-warning text-warning" : "fill-track text-track")}
        />
      ))}
    </span>
  );
}

/** Reseñas reales verificadas; si la API no manda (pocas), la sección no aparece. */
export function ResenasDestacadas() {
  const { data: resenas } = useResenasDestacadas();
  if (!resenas || resenas.length === 0) return null;

  return (
    <Seccion
      id="resenas"
      etiqueta="Reseñas verificadas"
      titulo="Lo que dicen los dueños"
      descripcion="Opiniones de personas que fueron a su cita con PetCat. Solo un dueño con una cita completada puede reseñar."
      className="bg-surface"
    >
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {resenas.map((r) => (
          <li key={r.id_resena} className="flex flex-col gap-4 rounded-modal bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <Estrellas calificacion={r.calificacion} />
              <Quote className="size-6 text-primary-soft" aria-hidden />
            </div>
            <figure className="flex flex-1 flex-col gap-4">
              <blockquote className="flex-1">
                {r.titulo && <p className="text-[16px] font-bold text-ink">{r.titulo}</p>}
                <p className="mt-1 text-[15px] leading-6 text-ink">“{r.comentario}”</p>
              </blockquote>
              <figcaption className="border-t border-border pt-4">
                <p className="text-[15px] font-semibold text-ink">{r.autor}</p>
                <p className="text-[14px] text-muted">{r.negocio.nombre}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-deep">
                  <BadgeCheck className="size-4" aria-hidden /> Visita verificada ·{" "}
                  {textoMes(r.visita_verificada)}
                </p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
