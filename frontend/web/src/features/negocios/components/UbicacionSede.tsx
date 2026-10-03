import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  Map as MapaGoogle,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { ExternalLink, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { claveMaps, enlaceGoogleMaps, mapId, redondear, SINCELEJO, type Ubicacion } from "@/lib/ubicacion";
import { cn } from "@/lib/utils";

type Errores = Partial<Record<keyof Ubicacion, string>>;

interface Props {
  value: Ubicacion;
  onChange: (ubicacion: Ubicacion) => void;
  errores?: Errores;
  disabled?: boolean;
}

const AYUDA = 'Con la ubicación, tu negocio aparece en "Cerca de mí" en la app.';

/**
 * Dirección y punto de una sede (A6b y E2). Con `VITE_GOOGLE_MAPS_API_KEY`: buscador de
 * Places (nuevo) limitado a Colombia y mapa con pin arrastrable. Sin clave, o si Google no
 * carga (clave inválida, cuota agotada), latitud y longitud manuales. La API solo guarda
 * las coordenadas: van juntas o ninguna. Arrastrar el pin no cambia la dirección (no hay
 * geocodificación inversa).
 */
export function UbicacionSede(props: Props) {
  const clave = claveMaps();
  const [fallo, setFallo] = useState(false);

  if (!clave || fallo) {
    return (
      <ModoManual
        {...props}
        aviso={fallo ? "No pudimos cargar el mapa. Escribe las coordenadas a mano." : undefined}
      />
    );
  }
  return (
    <APIProvider apiKey={clave} language="es" region="CO" onError={() => setFallo(true)}>
      <ModoGoogle {...props} onFallo={() => setFallo(true)} />
    </APIProvider>
  );
}

// ---------- Sin mapa ----------

/** "9,3" o "9.3" -> 9.3; vacío -> null; texto que no es número -> NaN (el esquema lo marca). */
const leerCoordenada = (texto: string): number | null => {
  const limpio = texto.trim().replace(",", ".");
  return limpio === "" ? null : Number(limpio);
};

const comoTexto = (valor: number | null) => (valor === null || Number.isNaN(valor) ? "" : String(valor));

function ModoManual({ value, onChange, errores = {}, disabled, aviso }: Props & { aviso?: string }) {
  const [latitud, setLatitud] = useState(comoTexto(value.latitud));
  const [longitud, setLongitud] = useState(comoTexto(value.longitud));

  // Si el valor cambió desde fuera (reinicio del formulario), se muestra ese; si no, lo escrito.
  const textoLatitud = Object.is(leerCoordenada(latitud), value.latitud) ? latitud : comoTexto(value.latitud);
  const textoLongitud = Object.is(leerCoordenada(longitud), value.longitud) ? longitud : comoTexto(value.longitud);

  const hayPunto =
    value.latitud !== null &&
    value.longitud !== null &&
    Number.isFinite(value.latitud) &&
    Number.isFinite(value.longitud);

  return (
    <div className="flex flex-col gap-4">
      {aviso && <Alert tono="advertencia">{aviso}</Alert>}
      <Field label="Dirección *" error={errores.direccion}>
        <Input
          value={value.direccion}
          disabled={disabled}
          autoComplete="street-address"
          onChange={(e) => onChange({ ...value, direccion: e.target.value })}
        />
      </Field>
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
      <p className="-mt-2 text-label text-muted">
        Opcionales. {AYUDA}{" "}
        {hayPunto && (
          <a
            href={enlaceGoogleMaps(value.latitud!, value.longitud!)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Ver en Google Maps <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </p>
    </div>
  );
}

// ---------- Con Google Maps ----------

function ModoGoogle({ value, onChange, errores = {}, disabled, onFallo }: Props & { onFallo: () => void }) {
  const estado = useApiLoadingStatus();
  const map = useMap();
  const fallida = estado === APILoadingStatus.FAILED || estado === APILoadingStatus.AUTH_FAILURE;

  useEffect(() => {
    if (fallida) onFallo();
  }, [fallida, onFallo]);

  const punto =
    value.latitud !== null && value.longitud !== null ? { lat: value.latitud, lng: value.longitud } : null;

  const marcar = (lat: number, lng: number) =>
    onChange({ ...value, latitud: redondear(lat), longitud: redondear(lng) });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Dirección *" error={errores.direccion}>
        <BuscadorDireccion
          texto={value.direccion}
          disabled={disabled}
          onTexto={(direccion) => onChange({ ...value, direccion })}
          onElegir={(direccion, lat, lng) => {
            onChange({ direccion, latitud: redondear(lat), longitud: redondear(lng) });
            map?.panTo({ lat, lng });
            map?.setZoom(17);
          }}
        />
      </Field>
      <div className="h-56 overflow-hidden rounded-control border bg-track">
        <MapaGoogle
          defaultCenter={punto ?? SINCELEJO}
          defaultZoom={punto ? 16 : 13}
          mapId={mapId()}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          onClick={(e) => {
            const latLng = e.detail.latLng;
            if (latLng && !disabled) marcar(latLng.lat, latLng.lng);
          }}
        >
          {punto && (
            <AdvancedMarker
              position={punto}
              draggable={!disabled}
              title="Ubicación de la sede"
              onDragEnd={(e) => {
                if (e.latLng) marcar(e.latLng.lat(), e.latLng.lng());
              }}
            />
          )}
        </MapaGoogle>
      </div>
      <div className="flex items-center justify-between gap-3 text-label text-muted">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          {punto
            ? `${punto.lat}, ${punto.lng} · Arrastra el pin para ajustar`
            : "Busca la dirección o toca el mapa para marcar tu local"}
        </span>
        {punto && !disabled && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onChange({ ...value, latitud: null, longitud: null })}
          >
            Quitar ubicación
          </Button>
        )}
      </div>
      {(errores.latitud || errores.longitud) && (
        <p className="text-label text-danger">{errores.latitud ?? errores.longitud}</p>
      )}
      <p className="rounded-control bg-primary-soft px-3 py-2 text-label text-primary-dark">{AYUDA}</p>
    </div>
  );
}

interface Sugerencia {
  id: string;
  principal: string;
  secundario: string;
  prediccion: google.maps.places.PlacePrediction;
}

/**
 * Combobox con la Places API nueva (`AutocompleteSuggestion`, una sesión por búsqueda),
 * limitada a Colombia y sesgada hacia Sincelejo. El texto escrito también vale como
 * dirección aunque no se elija una sugerencia.
 */
function BuscadorDireccion({
  texto,
  disabled,
  onTexto,
  onElegir,
}: {
  texto: string;
  disabled?: boolean;
  onTexto: (texto: string) => void;
  onElegir: (direccion: string, lat: number, lng: number) => void;
}) {
  const places = useMapsLibrary("places");
  const idLista = useId();
  const sesion = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [activa, setActiva] = useState(-1);
  const [error, setError] = useState(false);

  // Solo busca lo que el usuario escribe (no el texto inicial ni el elegido).
  useEffect(() => {
    if (!places || consulta === null || consulta.trim().length < 3) return;
    let vigente = true;
    const espera = setTimeout(() => {
      sesion.current ??= new places.AutocompleteSessionToken();
      places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: consulta,
        sessionToken: sesion.current,
        includedRegionCodes: ["co"],
        locationBias: { center: SINCELEJO, radius: 30_000 },
        language: "es",
      })
        .then(({ suggestions }) => {
          if (!vigente) return;
          setError(false);
          setActiva(-1);
          setSugerencias(
            suggestions.flatMap((s) =>
              s.placePrediction
                ? [
                    {
                      id: s.placePrediction.placeId,
                      principal: s.placePrediction.mainText?.text ?? s.placePrediction.text.text,
                      secundario: s.placePrediction.secondaryText?.text ?? "",
                      prediccion: s.placePrediction,
                    },
                  ]
                : [],
            ),
          );
        })
        .catch(() => vigente && setError(true));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [places, consulta]);

  const elegir = async (s: Sugerencia) => {
    setConsulta(null);
    setSugerencias([]);
    try {
      const lugar = s.prediccion.toPlace();
      await lugar.fetchFields({ fields: ["formattedAddress", "location"] });
      sesion.current = null; // la sesión termina al pedir los detalles
      const ubicacion = lugar.location;
      if (ubicacion) onElegir(lugar.formattedAddress ?? s.principal, ubicacion.lat(), ubicacion.lng());
      else onTexto(lugar.formattedAddress ?? s.principal);
    } catch {
      setError(true);
    }
  };

  // Con menos de 3 letras (o tras elegir) no se muestran las sugerencias anteriores.
  const visibles = consulta !== null && consulta.trim().length >= 3 ? sugerencias : [];
  const abierta = visibles.length > 0;
  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={abierta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={activa >= 0 ? `${idLista}-${activa}` : undefined}
        autoComplete="off"
        value={texto}
        disabled={disabled}
        placeholder="Busca la dirección de la sede"
        onChange={(e) => {
          onTexto(e.target.value);
          setConsulta(e.target.value);
        }}
        onBlur={() => setTimeout(() => setConsulta(null), 150)}
        onKeyDown={(e) => {
          if (!abierta) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiva((i) => (i + 1) % visibles.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiva((i) => (i <= 0 ? visibles.length - 1 : i - 1));
          } else if (e.key === "Enter" && activa >= 0) {
            e.preventDefault();
            void elegir(visibles[activa]!);
          } else if (e.key === "Escape") {
            setConsulta(null);
          }
        }}
      />
      {abierta && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-control border bg-white p-1 shadow-modal"
        >
          {visibles.map((s, i) => (
            <li
              key={s.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activa}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void elegir(s)}
              className={cn(
                "cursor-pointer rounded-[6px] px-2 py-1.5 text-body",
                i === activa ? "bg-selected" : "hover:bg-surface",
              )}
            >
              <span className="block text-ink">{s.principal}</span>
              {s.secundario && <span className="block text-label text-muted">{s.secundario}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-1 text-label text-muted">
          No pudimos buscar direcciones. Escribe la dirección y marca el punto en el mapa.
        </p>
      )}
    </div>
  );
}
