import { api } from "./client";
import type { CambiosMascota, DatosMascota, Mascota, MascotaConResumen, Pesos, Respuesta } from "./types";

// Funciones de /mascotas (rutas del dueño).

export async function getMascotas(): Promise<MascotaConResumen[]> {
  const { data } = await api.get<Respuesta<MascotaConResumen[]>>("/mascotas", {
    params: { incluir: "resumen" },
  });
  return data.data;
}

export async function getMascota(id_mascota: number): Promise<MascotaConResumen> {
  const { data } = await api.get<Respuesta<MascotaConResumen>>(`/mascotas/${id_mascota}`, {
    params: { incluir: "resumen" },
  });
  return data.data;
}

export async function getPesos(id_mascota: number, meses = 12): Promise<Pesos> {
  const { data } = await api.get<Respuesta<Pesos>>(`/mascotas/${id_mascota}/pesos`, { params: { meses } });
  return data.data;
}

export async function postMascota(datos: DatosMascota): Promise<Mascota> {
  const { data } = await api.post<Respuesta<Mascota>>("/mascotas", datos);
  return data.data;
}

export async function patchMascota(id_mascota: number, cambios: CambiosMascota): Promise<Mascota> {
  const { data } = await api.patch<Respuesta<Mascota>>(`/mascotas/${id_mascota}`, cambios);
  return data.data;
}

export async function deleteMascota(id_mascota: number) {
  await api.delete(`/mascotas/${id_mascota}`);
}

/** Cuerpo multipart de la foto: en React Native, FormData acepta el archivo como { uri, name, type }. */
export function formDataFoto(uri: string) {
  const form = new FormData();
  form.append("foto", { uri, name: "foto.jpg", type: "image/jpeg" } as unknown as Blob);
  return form;
}

/** Sube (o reemplaza) la foto. La imagen ya va comprimida en JPEG (ver lib/fotos.ts). */
export async function putFotoMascota(id_mascota: number, uri: string): Promise<Mascota> {
  const { data } = await api.put<Respuesta<Mascota>>(`/mascotas/${id_mascota}/foto`, formDataFoto(uri), {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60_000,
  });
  return data.data;
}

export async function deleteFotoMascota(id_mascota: number): Promise<Mascota> {
  const { data } = await api.delete<Respuesta<Mascota>>(`/mascotas/${id_mascota}/foto`);
  return data.data;
}
