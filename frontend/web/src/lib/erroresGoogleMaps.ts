/**
 * Errores de carga de la API de Google Maps. Google no avisa por código cuando la clave no
 * sirve (facturación sin activar, clave inválida, dominio no permitido, API sin habilitar):
 * pinta un mapa gris con un aviso y escribe en la consola
 * "Google Maps JavaScript API error: <Código>" (formato documentado en
 * https://developers.google.com/maps/documentation/javascript/error-messages).
 * Aquí se escucha esa línea para pasar a coordenadas manuales. La API se carga una sola vez
 * por página, así que el error se recuerda para las pantallas que se monten después.
 */
const PREFIJO = "Google Maps JavaScript API error:";

let ultimo: string | null = null;
const oyentes = new Set<(codigo: string) => void>();
let instalado = false;

const instalar = () => {
  if (instalado) return;
  instalado = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const texto = typeof args[0] === "string" ? args[0] : "";
    if (texto.startsWith(PREFIJO)) {
      ultimo = texto.slice(PREFIJO.length).trim().split(/\s/)[0] || "Error";
      oyentes.forEach((oyente) => oyente(ultimo!));
    }
    original(...args);
  };
};

/** Llama a `oyente` con el código del error (ya ocurrido o cuando ocurra). Devuelve cómo dejar de escuchar. */
export function escucharErrorGoogleMaps(oyente: (codigo: string) => void): () => void {
  instalar();
  if (ultimo) oyente(ultimo);
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Texto del aviso al pasar a coordenadas manuales. */
export const avisoErrorGoogleMaps = (codigo: string) =>
  codigo === "BillingNotEnabledMapError"
    ? "El mapa de Google no está disponible porque falta activar la facturación de Google Cloud. Escribe las coordenadas a mano."
    : "No pudimos cargar el mapa de Google. Escribe las coordenadas a mano.";

/** Solo para las pruebas. */
export const __reiniciarErroresGoogleMaps = () => {
  ultimo = null;
};
