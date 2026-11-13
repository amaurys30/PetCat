import * as publicoRepo from "./publico.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { autorPublico } from "../resenas/resena.service.js";

const UMBRAL_CIFRAS_POR_DEFECTO = 5;
const MIN_RESENAS_POR_DEFECTO = 3;
const DIAS_PRUEBA_POR_DEFECTO = 14;
// Reseñas de un mismo negocio en la landing, como máximo.
const RESENAS_POR_NEGOCIO = 2;

/** Las respuestas públicas se guardan en memoria este tiempo (la landing las pide en cada visita). */
export const CACHE_SEGUNDOS = 300;

const cache = new Map();

const enCache = async (clave, calcular) => {
  const guardado = cache.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;
  const valor = await calcular();
  cache.set(clave, { valor, vence: Date.now() + CACHE_SEGUNDOS * 1000 });
  return valor;
};

/** Para las pruebas: olvida lo guardado. */
export const limpiarCache = () => cache.clear();

/**
 * Cifras de la plataforma. Cada una es null si no supera `publico_umbral_cifras`: con pocos
 * datos no se muestra (ni se puede deducir) el número real.
 */
export const getEstadisticas = () =>
  enCache("estadisticas", async () => {
    const [cifras, umbral] = await Promise.all([
      publicoRepo.findEstadisticas(),
      configuracionRepo.getValor("publico_umbral_cifras", UMBRAL_CIFRAS_POR_DEFECTO),
    ]);
    const sobreUmbral = (valor) => (Number(valor) > umbral ? Number(valor) : null);
    return {
      negocios_activos: sobreUmbral(cifras.negocios_activos),
      ciudades: sobreUmbral(cifras.ciudades),
      citas_atendidas: sobreUmbral(cifras.citas_atendidas),
    };
  });

/** Reseñas para la landing; vacía si hay menos de `publico_min_resenas` elegibles. */
export const getResenas = (limit) =>
  enCache(`resenas:${limit}`, async () => {
    const [total, minimo] = await Promise.all([
      publicoRepo.countResenasElegibles(),
      configuracionRepo.getValor("publico_min_resenas", MIN_RESENAS_POR_DEFECTO),
    ]);
    if (total < minimo) return [];
    const rows = await publicoRepo.findResenasElegibles({ limit, porNegocio: RESENAS_POR_NEGOCIO });
    return rows.map((row) => ({
      id_resena: row.id_resena,
      calificacion: row.calificacion,
      titulo: row.titulo,
      comentario: row.comentario,
      autor: autorPublico(row.autor_nombre, row.autor_apellido),
      negocio: { id_negocio: row.id_negocio, nombre: row.negocio_nombre, tipo: row.negocio_tipo },
      visita_verificada: row.cita_fecha.slice(0, 7),
    }));
  });

/** Contacto de soporte (vacío = null) y días de la prueba Pro. */
export const getConfiguracion = () =>
  enCache("configuracion", async () => {
    const [email, whatsapp, dias] = await Promise.all([
      configuracionRepo.getValor("soporte_email", ""),
      configuracionRepo.getValor("soporte_whatsapp", ""),
      configuracionRepo.getValor("dias_prueba_gratis", DIAS_PRUEBA_POR_DEFECTO),
    ]);
    return {
      soporte: { email: String(email).trim() || null, whatsapp: String(whatsapp).trim() || null },
      prueba_pro_dias: dias,
    };
  });
