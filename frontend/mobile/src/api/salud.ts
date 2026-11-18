import { api, type Respuesta } from "./client";

export type Salud = { status: string; db: string; uptime: number; time: string };

export async function getSalud(): Promise<Salud> {
  const { data } = await api.get<Respuesta<Salud>>("/health");
  return data.data;
}
