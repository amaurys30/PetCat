import { api } from "./client";
import type { Respuesta, Salud } from "./types";

export async function getSalud(): Promise<Salud> {
  const { data } = await api.get<Respuesta<Salud>>("/health", { sinRenovar: true });
  return data.data;
}
