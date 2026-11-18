// Resuelve la URL base de la API.
//
// 1. EXPO_PUBLIC_API_URL, si está definida (build, túnel o adb reverse).
// 2. En desarrollo, la IP del computador que sirve el bundle (hostUri de Expo, la misma de la
//    terminal) con el puerto de la API de demo: el teléfono ya llega a esa IP.
// 3. Respaldo: localhost (o 10.0.2.2 en el emulador de Android).
export const PUERTO_API_DEMO = 3001;

type Opciones = {
  envUrl?: string;
  hostUri?: string | null;
  plataforma: string;
};

export function resolverApiUrl({ envUrl, hostUri, plataforma }: Opciones): string {
  const url = envUrl?.trim();
  if (url) return url.replace(/\/+$/, "");

  const host = hostUri ? hostUri.split(":")[0] : "";
  // Con --tunnel el host es de Expo (*.exp.direct) y no llega a la API: hace falta EXPO_PUBLIC_API_URL.
  if (host && !host.endsWith(".exp.direct")) return `http://${host}:${PUERTO_API_DEMO}/api/v1`;

  const local = plataforma === "android" ? "10.0.2.2" : "localhost";
  return `http://${local}:${PUERTO_API_DEMO}/api/v1`;
}
