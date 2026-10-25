import type { Plan } from "@/api/negocios";
import type { Suscripcion } from "@/api/types";

const sinCaracteristicas: Plan["caracteristicas"] = {
  estadisticas_avanzadas: false,
  soporte_prioritario: false,
  integracion_whatsapp: false,
  exportar_informes: false,
  ia_recomendaciones: false,
  api_personalizada: false,
  dominio_personalizado: false,
  gestor_dedicado: false,
  sla_garantizado: false,
  capacitacion_incluida: false,
};

/** Los tres planes del seed (`GET /planes`). */
export const planesDemo: Plan[] = [
  {
    id_plan: 1,
    nombre: "Gratuito",
    descripcion: null,
    precio_mensual: 0,
    precio_anual: 0,
    limites: { sucursales: 1, empleados: 3, citas_mes: 30, productos: 50 },
    caracteristicas: sinCaracteristicas,
  },
  {
    id_plan: 2,
    nombre: "Pro",
    descripcion: null,
    precio_mensual: 120000,
    precio_anual: 1080000,
    limites: { sucursales: 3, empleados: -1, citas_mes: -1, productos: -1 },
    caracteristicas: {
      ...sinCaracteristicas,
      estadisticas_avanzadas: true,
      soporte_prioritario: true,
      integracion_whatsapp: true,
    },
  },
  {
    id_plan: 3,
    nombre: "Enterprise",
    descripcion: null,
    precio_mensual: 280000,
    precio_anual: 2520000,
    limites: { sucursales: -1, empleados: -1, citas_mes: -1, productos: -1 },
    caracteristicas: {
      ...sinCaracteristicas,
      estadisticas_avanzadas: true,
      soporte_prioritario: true,
      integracion_whatsapp: true,
      ia_recomendaciones: true,
      api_personalizada: true,
      gestor_dedicado: true,
    },
  },
];

/** `GET /negocios/1/suscripcion`: Gratuito con la prueba disponible y 26 de 30 citas. */
export const suscripcionDemo = (cambios: Partial<Suscripcion> = {}): Suscripcion => ({
  plan: planesDemo[0]!,
  suscripcion: {
    id_suscripcion: 1,
    plan: { id_plan: 1, nombre: "Gratuito" },
    estado: "activa",
    tipo_facturacion: "mensual",
    fecha_inicio: "2026-09-01",
    fecha_fin: "9999-12-31",
    fecha_prueba_fin: null,
    dias_prueba_restantes: null,
    auto_renovar: false,
    monto_pagado: 0,
  },
  prueba_disponible: true,
  uso: {
    sucursales: { usadas: 1, maximo: 1 },
    empleados: { usadas: 3, maximo: 3 },
    citas_mes: { mes: "2026-10", usadas: 26, maximo: 30 },
    productos: { usadas: 0, maximo: 50 },
  },
  soporte: { email: "soporte@petcat.com.co", whatsapp: "+57 300 123 4567" },
  ...cambios,
});

/** La misma suscripción en la prueba Pro, con los límites del Pro. */
export const suscripcionEnPrueba = (dias = 14): Suscripcion =>
  suscripcionDemo({
    plan: planesDemo[1]!,
    suscripcion: {
      id_suscripcion: 2,
      plan: { id_plan: 2, nombre: "Pro" },
      estado: "en_prueba",
      tipo_facturacion: "mensual",
      fecha_inicio: "2026-10-23",
      fecha_fin: "2026-11-06",
      fecha_prueba_fin: "2026-11-06",
      dias_prueba_restantes: dias,
      auto_renovar: false,
      monto_pagado: 0,
    },
    prueba_disponible: false,
    uso: {
      sucursales: { usadas: 1, maximo: 3 },
      empleados: { usadas: 3, maximo: -1 },
      citas_mes: { mes: "2026-10", usadas: 26, maximo: -1 },
      productos: { usadas: 0, maximo: -1 },
    },
  });
