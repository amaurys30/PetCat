import type { Plan } from "@/api/negocios";
import type { Suscripcion } from "@/api/types";
import { dinero, fechaCorta } from "@/lib/format";

const ILIMITADO = -1;
/** Fecha de fin del plan Gratuito: no vence. */
export const SIN_VENCIMIENTO = "9999-12-31";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Lo que incluye un plan, armado con sus límites y características. Desde el segundo plan
 * solo lo que agrega al anterior ("Todo lo de Pro, y …"), para que las tarjetas no se
 * repitan.
 */
export function ventajasPlan(plan: Plan, anterior?: Plan): string[] {
  const { limites: l, caracteristicas: c } = plan;
  const ventajas: string[] = [];
  if (anterior) ventajas.push(`Todo lo de ${anterior.nombre}`);

  const otrosIlimitados = l.citas_mes === ILIMITADO && l.empleados === ILIMITADO && l.productos === ILIMITADO;
  const cambia = (clave: keyof Plan["limites"]) => !anterior || anterior.limites[clave] !== l[clave];

  if (cambia("sucursales")) {
    const sedes = l.sucursales === ILIMITADO ? "Sedes ilimitadas" : plural(l.sucursales, "sede", "sedes");
    ventajas.push(
      l.empleados === ILIMITADO ? sedes : `${sedes} · ${plural(l.empleados, "empleado", "empleados")}`,
    );
  }
  if (otrosIlimitados) {
    if (!anterior || anterior.limites.citas_mes !== ILIMITADO)
      ventajas.push("Citas, empleados y productos ilimitados");
  } else {
    if (l.citas_mes !== ILIMITADO) ventajas.push(`${l.citas_mes} citas al mes`);
    if (l.productos !== ILIMITADO) ventajas.push(plural(l.productos, "producto", "productos"));
  }

  const nueva = (clave: keyof Plan["caracteristicas"]) => c[clave] && !anterior?.caracteristicas[clave];
  if (nueva("estadisticas_avanzadas")) ventajas.push("Estadísticas avanzadas y 12 meses de historia");
  else if (!c.estadisticas_avanzadas) ventajas.push("Dashboard básico");
  if (nueva("soporte_prioritario")) ventajas.push("Soporte prioritario");
  if (nueva("ia_recomendaciones")) ventajas.push("Recomendaciones con IA");
  if (nueva("api_personalizada")) ventajas.push("Acceso a la API");
  if (nueva("gestor_dedicado")) ventajas.push("Gestor de cuenta dedicado");
  return ventajas;
}

/** "Sin vencimiento · $0", "Prueba gratis hasta el 6 nov 2026" o "Vence el 25 nov 2026 · $120.000/mes". */
export function lineaVencimiento({ plan, suscripcion }: Suscripcion): string {
  if (suscripcion?.estado === "en_prueba" && suscripcion.fecha_prueba_fin) {
    return `Prueba gratis hasta el ${fechaCorta(suscripcion.fecha_prueba_fin)}`;
  }
  const anual = suscripcion?.tipo_facturacion === "anual";
  const precio = anual ? plan.precio_anual : plan.precio_mensual;
  const valor = precio === 0 ? dinero(0) : `${dinero(precio)}/${anual ? "año" : "mes"}`;
  if (!suscripcion || suscripcion.estado === "vencida" || suscripcion.fecha_fin === SIN_VENCIMIENTO) {
    return `Sin vencimiento · ${valor}`;
  }
  return `Vence el ${fechaCorta(suscripcion.fecha_fin)} · ${valor}`;
}

/** Aviso cuando la prueba o el plan pago terminaron y el negocio volvió al Gratuito. */
export function avisoVencida({ plan, suscripcion }: Suscripcion): string | null {
  if (suscripcion?.estado !== "vencida") return null;
  // Solo la prueba tiene fecha_prueba_fin.
  const termino = suscripcion.fecha_prueba_fin
    ? `Tu prueba del plan ${suscripcion.plan.nombre} terminó el ${fechaCorta(suscripcion.fecha_prueba_fin)}`
    : `Tu plan ${suscripcion.plan.nombre} venció el ${fechaCorta(suscripcion.fecha_fin)}`;
  return `${termino}. Volviste al plan ${plan.nombre}: no se desactivó nada, pero ahora aplican sus límites.`;
}

export const diasRestantes = (dias: number) => (dias === 1 ? "queda 1 día" : `quedan ${dias} días`);

/** Enlace de WhatsApp: solo los dígitos del número (con el indicativo). */
export const enlaceWhatsapp = (numero: string, texto?: string) =>
  `https://wa.me/${numero.replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;

/** Contacto para contratar un plan: correo con asunto, o WhatsApp; null sin soporte configurado. */
export function enlaceContratar(soporte: Suscripcion["soporte"], asunto: string): string | null {
  if (soporte.email) return `mailto:${soporte.email}?subject=${encodeURIComponent(asunto)}`;
  if (soporte.whatsapp) return enlaceWhatsapp(soporte.whatsapp, asunto);
  return null;
}
