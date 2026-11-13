import type {
  ConfiguracionPublica,
  EstadisticasPublicas,
  NegocioBusqueda,
  ResenaLanding,
} from "@/api/publico";
import { API, http, HttpResponse, ok, servidor } from "./servidor";
import { planesDemo } from "./suscripcion";

export const negocioBusquedaDemo = (cambios: Partial<NegocioBusqueda> = {}): NegocioBusqueda => ({
  id_negocio: 1,
  nombre: "Clínica Veterinaria Patitas",
  tipo: "veterinaria",
  descripcion: "Consulta general y vacunación.",
  ciudad: "Sincelejo",
  logo_url: null,
  logo_miniatura_url: null,
  calificacion_promedio: 4.7,
  total_resenas: 12,
  verificado: true,
  destacado: false,
  confirmacion_automatica: false,
  distancia_km: 1.78,
  sucursal_cercana: { id_sucursal: 5, nombre: "Sede Sur", direccion: "Calle 10 # 15-20" },
  ...cambios,
});

export const resenaLandingDemo = (cambios: Partial<ResenaLanding> = {}): ResenaLanding => ({
  id_resena: 1,
  calificacion: 5,
  titulo: "Excelente atención",
  comentario: "El doctor Carlos fue muy amable con Max.",
  autor: "Sofía G.",
  negocio: { id_negocio: 1, nombre: "Clínica Veterinaria Patitas", tipo: "veterinaria" },
  visita_verificada: "2026-09",
  ...cambios,
});

interface Datos {
  estadisticas?: EstadisticasPublicas;
  resenas?: ResenaLanding[];
  configuracion?: ConfiguracionPublica;
  negocios?: NegocioBusqueda[];
}

/**
 * Lo que piden las páginas públicas. Devuelve las búsquedas de negocios recibidas (los query
 * params de cada GET /negocios).
 */
export function apiPublica({
  estadisticas = { negocios_activos: null, ciudades: null, citas_atendidas: null },
  resenas = [],
  configuracion = { soporte: { email: "soporte@petcat.com.co", whatsapp: null }, prueba_pro_dias: 14 },
  negocios = [negocioBusquedaDemo()],
}: Datos = {}) {
  const busquedas: URLSearchParams[] = [];
  servidor.use(
    http.get(`${API}/publico/estadisticas`, () => ok(estadisticas)),
    http.get(`${API}/publico/resenas`, () => ok(resenas)),
    http.get(`${API}/publico/configuracion`, () => ok(configuracion)),
    http.get(`${API}/politica-datos`, () => ok({ version: "1.0", url: "https://petcat.co/politica" })),
    http.get(`${API}/planes`, () => ok(planesDemo)),
    http.get(`${API}/negocios`, ({ request }) => {
      busquedas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        message: "OK",
        data: negocios,
        meta: { total: negocios.length, page: 1, limit: 6, totalPages: 1, hasNext: false },
      });
    }),
  );
  return { busquedas };
}
