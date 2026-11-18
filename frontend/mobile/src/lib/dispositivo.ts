import * as Device from "expo-device";

type DatosDispositivo = {
  manufacturer?: string | null;
  modelName?: string | null;
  osName?: string | null;
  osVersion?: string | null;
};

/**
 * Nombre del dispositivo para el login (`dispositivo`, máximo 200): "Samsung SM-A515F · Android 14".
 * La API lo guarda en la sesión para que el usuario reconozca dónde tiene la cuenta abierta.
 */
export function nombreDispositivo(datos: DatosDispositivo = Device): string {
  const marca = datos.manufacturer?.trim() ?? "";
  const modelo = datos.modelName?.trim() ?? "";
  // "Apple" + "iPhone 15", pero sin repetir: "Google" + "Google Pixel 8" queda "Google Pixel 8".
  const equipo = modelo.toLowerCase().startsWith(marca.toLowerCase()) ? modelo : `${marca} ${modelo}`.trim();
  const sistema = [datos.osName, datos.osVersion].filter(Boolean).join(" ");
  const nombre = [equipo, sistema].filter(Boolean).join(" · ");
  return (nombre || "Dispositivo móvil").slice(0, 200);
}
