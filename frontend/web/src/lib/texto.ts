/**
 * Dinero, iniciales y enlaces sin dependencias de fechas: las páginas públicas los usan sin
 * cargar date-fns. format.ts y suscripcion/textos.ts los reexportan.
 */

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** 1850000 -> "$ 1.850.000" */
export function dinero(valor: number): string {
  return COP.format(valor);
}

/**
 * Iniciales para avatares: primera letra de la primera y la última palabra con letras.
 * "Clínica Veterinaria Patitas" -> "CP", "Valentina Torres" -> "VT", "Huellitas" -> "HU".
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !/\d/.test(p));
  const primera = palabras[0];
  if (!primera) return "?";
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1]! : null;
  const letras = ultima ? primera[0]! + ultima[0]! : primera.slice(0, 2);
  return letras.toLocaleUpperCase("es");
}

/** Enlace de WhatsApp: solo los dígitos del número (con el indicativo). */
export const enlaceWhatsapp = (numero: string, texto?: string) =>
  `https://wa.me/${numero.replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
