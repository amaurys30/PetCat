import { ExternalLink } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { avisoErrorGoogleMaps, escucharErrorGoogleMaps } from "@/lib/erroresGoogleMaps";
import { claveMaps, enlaceGoogleMaps } from "@/lib/ubicacion";
import { AYUDA_UBICACION, type PropsUbicacion } from "./ubicacionComun";

type Props = PropsUbicacion;

// Google Maps y Places solo se descargan si hay clave y se muestra el mapa.
const UbicacionGoogle = lazy(async () => ({ default: (await import("./UbicacionGoogle")).UbicacionGoogle }));

/**
 * Dirección y punto de una sede (A6b y E2). Con `VITE_GOOGLE_MAPS_API_KEY`: buscador de
 * Places (nuevo) limitado a Colombia y mapa con pin arrastrable. Sin clave, o si Google no
 * carga (clave inválida, cuota agotada), latitud y longitud manuales. La API solo guarda
 * las coordenadas: van juntas o ninguna. Arrastrar el pin no cambia la dirección (no hay
 * geocodificación inversa).
 */
export function UbicacionSede(props: Props) {
  const clave = claveMaps();
  // Aviso que se muestra al pasar a coordenadas manuales porque Google falló.
  const [fallo, setFallo] = useState<string | null>(null);

  // Facturación sin activar, clave inválida o dominio no permitido: Google solo lo dice en la consola.
  useEffect(() => {
    if (!clave) return;
    return escucharErrorGoogleMaps((codigo) => setFallo(avisoErrorGoogleMaps(codigo)));
  }, [clave]);

  if (!clave || fallo) return <ModoManual {...props} aviso={fallo ?? undefined} />;
  return (
    <Suspense fallback={<Skeleton etiqueta="Cargando el mapa" className="h-72 rounded-card" />}>
      <UbicacionGoogle {...props} clave={clave} onFallo={() => setFallo(avisoErrorGoogleMaps("Error"))} />
    </Suspense>
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
  const textoLongitud = Object.is(leerCoordenada(longitud), value.longitud)
    ? longitud
    : comoTexto(value.longitud);

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
        Opcionales. {AYUDA_UBICACION}{" "}
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
