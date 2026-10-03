import { apiGet, apiPost } from "./client";
import type { Body, DataGet, Sesion } from "./types";

export type Invitacion = DataGet<"/invitaciones/{token}">;
export type AceptarInvitacionBody = Body<"/invitaciones/{token}/aceptar", "post">;

/** Pública. 404 si no existe; 409 si ya se usó, venció o el empleado ya tiene cuenta. */
export const getInvitacion = (token: string) =>
  apiGet<Invitacion>(`/invitaciones/${token}`, undefined, { sinRenovar: true });

/**
 * Pública: responde como el login. Sin renovación automática: un 401 aquí es
 * "contraseña incorrecta" (cuenta existente), no una sesión vencida.
 */
export const aceptarInvitacion = (token: string, body: AceptarInvitacionBody) =>
  apiPost<Sesion>(`/invitaciones/${token}/aceptar`, body, { sinRenovar: true });
