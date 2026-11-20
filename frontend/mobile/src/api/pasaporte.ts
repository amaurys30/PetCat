import { api } from "./client";
import type { Meta, RegistroHistorial, Respuesta, Vacuna } from "./types";

// Pasaporte PetCat y línea de vida (rutas del dueño).

/** Todas las dosis de la mascota, de la más reciente a la más antigua, con su estado calculado. */
export async function getVacunas(id_mascota: number): Promise<Vacuna[]> {
  const { data } = await api.get<Respuesta<Vacuna[]>>(`/mascotas/${id_mascota}/vacunas`);
  return data.data;
}

export type PaginaHistorial = { registros: RegistroHistorial[]; meta: Meta };

/** Una página del historial (del más reciente al más antiguo). `tipos` vacío: todos. */
export async function getHistorial(
  id_mascota: number,
  { tipos = [], page = 1, limit = 20 }: { tipos?: readonly string[]; page?: number; limit?: number } = {},
): Promise<PaginaHistorial> {
  const { data } = await api.get<Respuesta<RegistroHistorial[]>>(`/mascotas/${id_mascota}/historial`, {
    params: { page, limit, ...(tipos.length > 0 && { tipo: tipos.join(",") }) },
  });
  return { registros: data.data, meta: data.meta! };
}

/** La desparasitación más reciente (o null), para su sello en el Pasaporte. */
export async function getUltimaDesparasitacion(id_mascota: number): Promise<RegistroHistorial | null> {
  const { registros } = await getHistorial(id_mascota, { tipos: ["desparasitacion"], limit: 1 });
  return registros[0] ?? null;
}
