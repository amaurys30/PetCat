import { ChevronDown, ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { lazy, Suspense, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { enlaceMapa, redondear, tienePunto } from "@/lib/ubicacion";
import { cn } from "@/lib/utils";
import { AYUDA_UBICACION, type PropsUbicacion } from "./ubicacionComun";

type Props = PropsUbicacion;

// Leaflet y sus estilos solo se descargan al mostrar el formulario de una sede.
const MapaUbicacion = lazy(async () => ({ default: (await import("./MapaUbicacion")).MapaUbicacion }));

const AVISO_SIN_MAPA = "No pudimos cargar el mapa. Usa tu ubicación actual o escribe las coordenadas.";

/**
 * Dirección y punto de una sede (A6b y E2). La dirección se escribe como texto (no hay
 * autocompletado). El punto se marca tocando el mapa (Leaflet con OpenStreetMap, o el
 * proveedor de `VITE_MAP_TILES_URL`), arrastrando el pin o con la ubicación actual del
 * navegador; las coordenadas manuales quedan como respaldo, y se abren solas si el mapa no
 * carga. La API solo guarda las coordenadas: van juntas o ninguna.
 */
export function UbicacionSede({ value, onChange, errores = {}, disabled }: Props) {
  const [falloMapa, setFalloMapa] = useState(false);
  const [manualAbierto, setManualAbierto] = useState(false);
  // Se incrementa cuando el punto llega de la ubicación actual, para que el mapa vaya hasta él.
  const [enfoque, setEnfoque] = useState(0);
  const idManual = useId();

  const punto = tienePunto(value) ? { lat: value.latitud, lng: value.longitud } : null;
  const marcar = (lat: number, lng: number) =>
    onChange({ ...value, latitud: redondear(lat), longitud: redondear(lng) });
  const verManual = manualAbierto || falloMapa;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Dirección *" error={errores.direccion}>
        <Input
          value={value.direccion}
          disabled={disabled}
          autoComplete="street-address"
          placeholder="Ej.: Cra 19 # 22-35, barrio Majagual"
          onChange={(e) => onChange({ ...value, direccion: e.target.value })}
        />
      </Field>

      {falloMapa ? (
        <Alert tono="advertencia">{AVISO_SIN_MAPA}</Alert>
      ) : (
        <Suspense fallback={<Skeleton etiqueta="Cargando el mapa" className="h-56 rounded-control" />}>
          <MapaUbicacion
            punto={punto}
            enfoque={enfoque}
            disabled={disabled}
            onMarcar={marcar}
            onFallo={() => setFalloMapa(true)}
          />
        </Suspense>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-label text-muted">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          {punto
            ? `${punto.lat}, ${punto.lng}${falloMapa ? "" : " · Arrastra el pin para ajustar"}`
            : falloMapa
              ? "Sin ubicación marcada"
              : "Toca el mapa para marcar tu local"}
        </span>
        {punto && !disabled && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => onChange({ ...value, latitud: null, longitud: null })}
          >
            Quitar ubicación
          </Button>
        )}
      </div>

      {!disabled && (
        <UbicacionActual
          onUbicar={(lat, lng) => {
            marcar(lat, lng);
            setEnfoque((n) => n + 1);
          }}
        />
      )}

      {!falloMapa && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start"
          aria-expanded={verManual}
          aria-controls={idManual}
          onClick={() => setManualAbierto((v) => !v)}
        >
          Escribir coordenadas
          <ChevronDown className={cn("transition-transform", verManual && "rotate-180")} aria-hidden />
        </Button>
      )}
      {verManual && (
        <div id={idManual}>
          <Coordenadas value={value} onChange={onChange} errores={errores} disabled={disabled} />
        </div>
      )}
      {!verManual && (errores.latitud || errores.longitud) && (
        <p className="text-label text-danger">{errores.latitud ?? errores.longitud}</p>
      )}

      <p className="rounded-control bg-primary-soft px-3 py-2 text-label text-primary-dark">
        {AYUDA_UBICACION}
      </p>
    </div>
  );
}

// ---------- Ubicación actual ----------

/** La geolocalización solo existe en contextos seguros (HTTPS o localhost). */
const hayGeolocalizacion = () => typeof navigator !== "undefined" && "geolocation" in navigator;

function UbicacionActual({ onUbicar }: { onUbicar: (lat: number, lng: number) => void }) {
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!hayGeolocalizacion()) return null;

  const ubicar = () => {
    setBuscando(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBuscando(false);
        onUbicar(coords.latitude, coords.longitude);
      },
      (e) => {
        setBuscando(false);
        setError(
          e.code === e.PERMISSION_DENIED
            ? "No diste permiso para usar tu ubicación. Toca el mapa o escribe las coordenadas."
            : "No pudimos obtener tu ubicación. Toca el mapa o escribe las coordenadas.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        cargando={buscando}
        onClick={ubicar}
      >
        <LocateFixed aria-hidden />
        Usar mi ubicación actual
      </Button>
      {error ? (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      ) : (
        <p className="text-label text-muted">Úsala si estás en la sede.</p>
      )}
    </div>
  );
}

// ---------- Coordenadas manuales ----------

/** "9,3" o "9.3" -> 9.3; vacío -> null; texto que no es número -> NaN (el esquema lo marca). */
const leerCoordenada = (texto: string): number | null => {
  const limpio = texto.trim().replace(",", ".");
  return limpio === "" ? null : Number(limpio);
};

const comoTexto = (valor: number | null) => (valor === null || Number.isNaN(valor) ? "" : String(valor));

function Coordenadas({ value, onChange, errores = {}, disabled }: Props) {
  const [latitud, setLatitud] = useState(comoTexto(value.latitud));
  const [longitud, setLongitud] = useState(comoTexto(value.longitud));

  // Si el valor cambió desde fuera (mapa, ubicación actual, reinicio), se muestra ese; si no, lo escrito.
  const textoLatitud = Object.is(leerCoordenada(latitud), value.latitud) ? latitud : comoTexto(value.latitud);
  const textoLongitud = Object.is(leerCoordenada(longitud), value.longitud)
    ? longitud
    : comoTexto(value.longitud);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitud" error={errores.latitud}>
          <Input
            inputMode="decimal"
            placeholder="9.30472"
            value={textoLatitud}
            disabled={disabled}
            onChange={(e) => {
              setLatitud(e.target.value);
              onChange({ ...value, latitud: leerCoordenada(e.target.value) });
            }}
          />
        </Field>
        <Field label="Longitud" error={errores.longitud}>
          <Input
            inputMode="decimal"
            placeholder="-75.39778"
            value={textoLongitud}
            disabled={disabled}
            onChange={(e) => {
              setLongitud(e.target.value);
              onChange({ ...value, longitud: leerCoordenada(e.target.value) });
            }}
          />
        </Field>
      </div>
      <p className="text-label text-muted">
        Opcionales.{" "}
        {tienePunto(value) && (
          <a
            href={enlaceMapa(value.latitud, value.longitud)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Ver en OpenStreetMap <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </p>
    </div>
  );
}
