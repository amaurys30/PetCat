import { z } from "zod";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Esquema de query reutilizable: `paginationSchema.extend({ estado: ... })`.
 * Un limit mayor a 100 responde 422.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

const toPositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Lee page y limit (ya validados o crudos) y devuelve { page, limit, offset }.
 * Sin validar, los valores inválidos toman el valor por defecto y limit se recorta a 100.
 */
export const getPagination = (query = {}) => {
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
};

export const buildMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return { total, page, limit, totalPages, hasNext: page < totalPages };
};
