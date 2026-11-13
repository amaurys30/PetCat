import "leaflet/dist/leaflet.css";
import { divIcon, type Marker as MarcadorLeaflet } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { capaMapa, SINCELEJO } from "@/lib/ubicacion";

export interface Punto {
  lat: number;
  lng: number;
}

interface Props {
  punto: Punto | null;
  /** Cambia cada vez que el punto llega de fuera del mapa (ubicación actual): el mapa va hasta él. */
  enfoque: number;
  disabled?: boolean;
  onMarcar: (lat: number, lng: number) => void;
  /** Ningún mosaico cargó (sin conexión o proveedor caído). */
  onFallo: () => void;
}

// Pin propio en HTML: el ícono por defecto de Leaflet son imágenes que el empaquetador no resuelve.
const PIN = divIcon({
  className: "",
  html: `<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" class="text-primary drop-shadow"><path fill="currentColor" stroke="#fff" stroke-width="1.5" d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5s7.5-7.9 7.5-13.5A7.5 7.5 0 0 0 12 1.5Z"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 31],
});

/** Mapa de UbicacionSede (Leaflet), en su propio archivo para cargarlo de forma diferida. */
export function MapaUbicacion({ punto, enfoque, disabled, onMarcar, onFallo }: Props) {
  const { url, atribucion } = capaMapa();
  const algunoCargo = useRef(false);

  return (
    // `isolate`: los paneles de Leaflet usan z-index altos y no deben tapar menús ni diálogos.
    <div className="isolate h-56 overflow-hidden rounded-control border bg-track">
      <MapContainer
        center={punto ?? SINCELEJO}
        zoom={punto ? 16 : 13}
        scrollWheelZoom={false}
        zoomControl={false}
        className="size-full"
      >
        <ZoomControl zoomInTitle="Acercar" zoomOutTitle="Alejar" />
        <TileLayer
          url={url}
          attribution={atribucion}
          maxZoom={19}
          eventHandlers={{
            tileload: () => {
              algunoCargo.current = true;
            },
            tileerror: () => {
              if (!algunoCargo.current) onFallo();
            },
          }}
        />
        <Eventos disabled={disabled} onMarcar={onMarcar} />
        <Seguir punto={punto} enfoque={enfoque} />
        {punto && (
          <Marker
            position={punto}
            icon={PIN}
            draggable={!disabled}
            title="Ubicación de la sede"
            alt="Ubicación de la sede"
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as MarcadorLeaflet).getLatLng();
                onMarcar(lat, lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

function Eventos({ disabled, onMarcar }: Pick<Props, "disabled" | "onMarcar">) {
  useMapEvents({
    click: (e) => {
      if (!disabled) onMarcar(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Lleva el mapa al punto si llegó de la ubicación actual o si quedó fuera de la vista. */
function Seguir({ punto, enfoque }: Pick<Props, "punto" | "enfoque">) {
  const map = useMap();
  const ultimoEnfoque = useRef(enfoque);
  const lat = punto?.lat;
  const lng = punto?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    if (enfoque !== ultimoEnfoque.current) {
      ultimoEnfoque.current = enfoque;
      map.setView([lat, lng], 17);
    } else if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
  }, [map, lat, lng, enfoque]);
  return null;
}
