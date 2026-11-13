import { z } from "zod";

export const RESENAS_MAX = 12;

export const resenasQuery = z.object({
  limit: z.coerce.number().int().min(1).max(RESENAS_MAX).default(6),
});
