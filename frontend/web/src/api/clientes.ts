import { apiGet, apiGetPagina, apiPost } from "./client";
import type { components } from "./schema";
import type { Body, DataGet } from "./types";

type Schemas = components["schemas"];

export type ClienteBuscado = DataGet<"/negocios/{id_negocio}/clientes/buscar">[number];
export type ClienteFila = Schemas["ClienteFila"];
export type ClienteDetalle = Schemas["ClienteDetalle"];
export type RegistrarClienteBody = Body<"/negocios/{id_negocio}/clientes", "post">;
export type MascotaNueva = Body<"/negocios/{id_negocio}/clientes/{id_usuario}/mascotas", "post">;
export type Mascota = Schemas["Mascota"];
export type ClienteRegistrado = {
  cliente: Schemas["ClienteContacto"];
  mascota: Mascota;
  sin_cuenta: boolean;
};

/**
 * citas.crear o clientes.ver. Coincidencia exacta por email o por teléfono (solo los
 * dígitos), hasta 5, con sus mascotas vivas. Tiene un límite estricto de solicitudes: se
 * busca al confirmar, no en cada tecla.
 */
export const buscarClientes = (idNegocio: number, consulta: { email: string } | { telefono: string }) =>
  apiGet<ClienteBuscado[]>(`/negocios/${idNegocio}/clientes/buscar`, consulta);

/** clientes.ver. Clientes del negocio por nombre, correo, teléfono o mascota. */
export const getClientes = (idNegocio: number, params: { q?: string; limit?: number; page?: number }) =>
  apiGetPagina<ClienteFila>(`/negocios/${idNegocio}/clientes`, params);

/** clientes.ver. Contacto, cumplimiento y mascotas del cliente con este negocio. */
export const getCliente = (idNegocio: number, idUsuario: number) =>
  apiGet<ClienteDetalle>(`/negocios/${idNegocio}/clientes/${idUsuario}`);

/**
 * citas.crear (C3). Con correo recibe la bienvenida; sin correo queda sin cuenta (el
 * teléfono es obligatorio). La autorización de la Ley 1581 es obligatoria.
 */
export const registrarCliente = (idNegocio: number, body: RegistrarClienteBody) =>
  apiPost<ClienteRegistrado>(`/negocios/${idNegocio}/clientes`, body);

/** citas.crear (C6). 403 si el cliente aún no tiene relación con el negocio. */
export const agregarMascota = (idNegocio: number, idUsuario: number, body: MascotaNueva) =>
  apiPost<Mascota>(`/negocios/${idNegocio}/clientes/${idUsuario}/mascotas`, body);
