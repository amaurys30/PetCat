import { api } from "./client";
import type { Cita, DatosReprogramacion, DatosReserva, HorariosLibres, Meta, Respuesta } from "./types";

// Citas del dueño (app): horarios libres, reservar, mis citas, detalle, cancelar y reprogramar.

export type AlcanceCitas = "proximas" | "pasadas";

export async function getHorariosLibres(params: {
  id_servicio: number;
  id_sucursal: number;
  fecha: string;
}): Promise<HorariosLibres> {
  const { data } = await api.get<Respuesta<HorariosLibres>>("/citas/horarios-libres", { params });
  return data.data;
}

export async function postCita(datos: DatosReserva): Promise<{ cita: Cita; mensaje: string }> {
  const { data } = await api.post<Respuesta<Cita>>("/citas", datos);
  return { cita: data.data, mensaje: data.message };
}

export async function getMisCitas(alcance: AlcanceCitas, page = 1): Promise<{ citas: Cita[]; meta: Meta }> {
  const { data } = await api.get<Respuesta<Cita[]>>("/citas/mias", { params: { alcance, page, limit: 20 } });
  return { citas: data.data, meta: data.meta! };
}

export async function getCita(id_cita: number): Promise<Cita> {
  const { data } = await api.get<Respuesta<Cita>>(`/citas/${id_cita}`);
  return data.data;
}

export async function cancelarCita(id_cita: number): Promise<Cita> {
  const { data } = await api.post<Respuesta<Cita>>(`/citas/${id_cita}/cancelar`, {});
  return data.data;
}

/** Crea la cita nueva (la original queda `reprogramada`) y la devuelve. */
export async function reprogramarCita(id_cita: number, datos: DatosReprogramacion): Promise<Cita> {
  const { data } = await api.post<Respuesta<Cita>>(`/citas/${id_cita}/reprogramar`, datos);
  return data.data;
}
