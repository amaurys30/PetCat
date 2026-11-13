import { BadgeCheck, LocateFixed, MapPin, Search, Star, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { NegocioBusqueda } from "@/api/publico";
import { Skeleton } from "@/components/ui/skeleton";
import { iniciales } from "@/lib/format";
import { cn } from "@/lib/utils";
import { botonSecundario } from "../estilos";
import { POR_PAGINA, useNegociosCercanos } from "../hooks/usePublico";
import { FILTROS_TIPO, SINCELEJO, textoCalificacion, textoDistancia, textoNumero, textoTipo } from "../textos";

type Origen = { tipo: "sincelejo" } | { tipo: "ubicacion"; lat: number; lng: number };
type EstadoUbicacion = "inactiva" | "buscando" | "denegada" | "no-disponible";

const coordenadas = (origen: Origen) =>
  origen.tipo === "ubicacion" ? { lat: origen.lat, lng: origen.lng } : SINCELEJO;

/**
 * Buscador de negocios cercanos con GET /negocios. Usa la ubicación del navegador si el
 * usuario ya la permitió o la pide con "Usar mi ubicación"; si no, busca cerca de Sincelejo.
 */
export function BuscadorNegocios() {
  const [origen, setOrigen] = useState<Origen>({ tipo: "sincelejo" });
  const [ubicacion, setUbicacion] = useState<EstadoUbicacion>("inactiva");
  const [tipo, setTipo] = useState<string | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");

  const geolocalizacion = typeof navigator !== "undefined" ? navigator.geolocation : undefined;

  const pedirUbicacion = () => {
    if (!geolocalizacion) {
      setUbicacion("no-disponible");
      return;
    }
    setUbicacion("buscando");
    geolocalizacion.getCurrentPosition(
      (pos) => {
        setOrigen({ tipo: "ubicacion", lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUbicacion("inactiva");
      },
      () => {
        setOrigen({ tipo: "sincelejo" });
        setUbicacion("denegada");
      },
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };

  // Si el usuario ya dio permiso en otra visita, se usa su ubicación sin preguntar.
  useEffect(() => {
    let vigente = true;
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((permiso) => {
        if (vigente && permiso.state === "granted") pedirUbicacion();
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La búsqueda por nombre espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const consulta = useNegociosCercanos({ ...coordenadas(origen), tipo, q: q || undefined });
  const negocios = consulta.data?.pages.flatMap((p) => p.data) ?? [];
  const total = consulta.data?.pages[0]?.meta.total ?? 0;
  const cerca = origen.tipo === "ubicacion" ? "de tu ubicación" : "de Sincelejo";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-modal border border-border bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar por nombre</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre"
              maxLength={100}
              className="h-12 w-full rounded-card border border-border bg-white pr-4 pl-12 text-[16px] text-ink placeholder:text-muted focus-visible:border-primary-dark"
            />
          </label>
          {origen.tipo === "ubicacion" ? (
            <button type="button" className={botonSecundario} onClick={() => setOrigen({ tipo: "sincelejo" })}>
              <MapPin aria-hidden /> Ver Sincelejo
            </button>
          ) : (
            <button
              type="button"
              className={botonSecundario}
              onClick={pedirUbicacion}
              disabled={ubicacion === "buscando"}
            >
              <LocateFixed aria-hidden /> {ubicacion === "buscando" ? "Buscando tu ubicación…" : "Usar mi ubicación"}
            </button>
          )}
        </div>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div role="group" aria-label="Tipo de negocio" className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {FILTROS_TIPO.map((f) => {
              const activo = f.valor === tipo;
              return (
                <button
                  key={f.texto}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setTipo(f.valor)}
                  className={cn(
                    "h-10 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors",
                    activo
                      ? "border-primary-dark bg-primary-dark text-white"
                      : "border-border bg-white text-ink hover:bg-surface",
                  )}
                >
                  {f.texto}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[14px] text-muted" aria-live="polite">
          {ubicacion === "denegada" &&
            "No pudimos usar tu ubicación (permiso denegado o sin señal). Te mostramos los negocios de Sincelejo. "}
          {ubicacion === "no-disponible" && "Tu navegador no comparte la ubicación. Te mostramos los negocios de Sincelejo. "}
          {consulta.isSuccess &&
            (total === 1 ? `1 negocio cerca ${cerca}.` : `${textoNumero(total)} negocios cerca ${cerca}.`)}
        </p>
      </div>

      {consulta.isPending ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando negocios">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex flex-col gap-4 rounded-modal border border-border bg-white p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="size-14 rounded-card" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </li>
          ))}
        </ul>
      ) : consulta.isError ? (
        <div className="rounded-modal border border-border bg-white p-8 text-center">
          <p className="text-[16px] font-semibold text-ink">No pudimos cargar los negocios.</p>
          <button type="button" className={cn(botonSecundario, "mt-4")} onClick={() => void consulta.refetch()}>
            Reintentar
          </button>
        </div>
      ) : negocios.length === 0 ? (
        <div className="rounded-modal border border-dashed border-border bg-white p-8 text-center">
          <p className="text-[16px] font-semibold text-ink">
            {origen.tipo === "ubicacion"
              ? "Todavía no hay negocios de PetCat a menos de 10 km de ti."
              : "No encontramos negocios con esa búsqueda."}
          </p>
          <p className="mt-2 text-[15px] text-muted">
            {origen.tipo === "ubicacion"
              ? "Por ahora estamos en Sincelejo, Sucre."
              : "Prueba con otro nombre o con otro tipo de negocio."}
          </p>
          {origen.tipo === "ubicacion" && (
            <button type="button" className={cn(botonSecundario, "mt-4")} onClick={() => setOrigen({ tipo: "sincelejo" })}>
              Ver negocios en Sincelejo
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Negocios cercanos">
            {negocios.map((n) => (
              <TarjetaNegocio key={n.id_negocio} negocio={n} />
            ))}
          </ul>
          {consulta.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                className={botonSecundario}
                onClick={() => void consulta.fetchNextPage()}
                disabled={consulta.isFetchingNextPage}
              >
                {consulta.isFetchingNextPage ? "Cargando…" : `Ver ${POR_PAGINA} negocios más`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaNegocio({ negocio: n }: { negocio: NegocioBusqueda }) {
  const logo = n.logo_miniatura_url ?? n.logo_url;
  return (
    <li className="flex flex-col gap-4 rounded-modal border border-border bg-white p-6">
      <div className="flex items-start gap-4">
        {logo ? (
          <img src={logo} alt="" className="size-14 shrink-0 rounded-card border border-border object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-card bg-primary-soft text-[18px] font-bold text-primary-deep"
          >
            {iniciales(n.nombre)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[17px] leading-6 font-bold text-ink">{n.nombre}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px] text-muted">
            {textoTipo(n.tipo)}
            {n.verificado && (
              <span className="inline-flex items-center gap-1 font-semibold text-primary-deep">
                <BadgeCheck className="size-4" aria-hidden /> Verificado
              </span>
            )}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 text-[14px] text-ink">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Calificación</dt>
          <Star className="size-4 shrink-0 fill-warning text-warning" aria-hidden />
          <dd>
            {n.total_resenas > 0 ? (
              <>
                <span className="font-semibold">{textoCalificacion(n.calificacion_promedio)}</span>
                <span className="text-muted">
                  {" "}
                  ({n.total_resenas === 1 ? "1 reseña" : `${textoNumero(n.total_resenas)} reseñas`})
                </span>
              </>
            ) : (
              <span className="text-muted">Sin reseñas aún</span>
            )}
          </dd>
        </div>
        {n.distancia_km !== null && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Distancia</dt>
            <MapPin className="size-4 shrink-0 text-primary-deep" aria-hidden />
            <dd>
              {textoDistancia(n.distancia_km)}
              {n.sucursal_cercana && <span className="text-muted"> · {n.sucursal_cercana.nombre}</span>}
            </dd>
          </div>
        )}
      </dl>

      {n.confirmacion_automatica && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold text-primary-deep">
          <Zap className="size-4" aria-hidden /> Confirmación inmediata
        </p>
      )}

      <button
        type="button"
        disabled
        className="mt-auto h-11 rounded-card border border-border bg-surface px-4 text-[14px] font-semibold text-muted"
      >
        Reservar desde la app · próximamente
      </button>
    </li>
  );
}
