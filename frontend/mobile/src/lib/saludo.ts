import { partesEnBogota } from "./fechas";

/** "Buenos días" (5:00–11:59), "Buenas tardes" (12:00–18:59), "Buenas noches", en hora de Bogotá. */
export function saludo(ahora: Date = new Date()): string {
  const { hora } = partesEnBogota(ahora);
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
