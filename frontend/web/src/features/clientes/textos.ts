import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { CitaPanel } from "@/api/citas";
import type { ClienteFila, CorreoAsignado } from "@/api/clientes";
import { textoEdad, textoPeso } from "@/features/agenda/textos";
import { hora, hoyISO, parseFecha } from "@/lib/format";
import { sumarDias } from "@/lib/agenda";
import { ESPECIES } from "./schemas";

/** "perro" -> "Perro"; una especie fuera de la lista se muestra tal cual. */
export const textoEspecie = (especie: string) => ESPECIES.find((e) => e.valor === especie)?.texto ?? especie;

/** "Perro · Labrador · 6 años · 28 kg" */
export function lineaMascota(m: {
  especie: string;
  raza: string | null;
  edad_meses?: number | null;
  peso?: number | null;
}): string {
  return [textoEspecie(m.especie), m.raza, textoEdad(m.edad_meses ?? null), textoPeso(m.peso ?? null)]
    .filter(Boolean)
    .join(" · ");
}

/** Días desde la primera relación con el negocio en que un cliente se ve como "Nuevo". */
export const DIAS_CLIENTE_NUEVO = 30;

export const esClienteNuevo = (c: Pick<ClienteFila, "cliente_desde">, hoy = hoyISO()) =>
  c.cliente_desde >= sumarDias(hoy, -DIAS_CLIENTE_NUEVO);

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const TEXTO_SIN_CUENTA =
  "Registrado sin correo: no recibe correos ni recordatorios y no puede entrar a la app";

export const TEXTO_LEY_1581 =
  "Escribe solo lo que no te incomodaría que el cliente leyera: por la Ley 1581 puede pedir conocer sus datos. Los diagnósticos van en el historial médico.";

/** "Jue 25 · 8:00" */
export const diaYHora = (c: Pick<CitaPanel, "fecha" | "hora_inicio">) => {
  const dia = format(parseFecha(c.fecha), "EEE d", { locale: es });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora(c.hora_inicio)}`;
};

/** "25 sep, 8:00" */
export const fechaCita = (c: Pick<CitaPanel, "fecha" | "hora_inicio">) =>
  `${format(parseFecha(c.fecha), "d MMM", { locale: es }).replace(".", "")}, ${hora(c.hora_inicio)}`;

export const TEXTO_CORREO: Record<CorreoAsignado["accion"], string> = {
  agregado: "Correo agregado. Le enviamos la bienvenida para que active su cuenta",
  corregido: "Correo corregido. Le enviamos una bienvenida nueva; el enlace anterior ya no sirve",
  reenviado: "Le reenviamos la bienvenida",
};
