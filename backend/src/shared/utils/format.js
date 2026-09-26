/**
 * MySQL devuelve BOOLEAN como 0/1 y DECIMAL como texto. Estas funciones dejan
 * los valores como los espera el cliente (true/false y números), respetando null.
 */
export const toBool = (value) => (value === null || value === undefined ? value : Boolean(value));

export const toNumber = (value) => (value === null || value === undefined ? value : Number(value));

/** Convierte en el objeto las columnas indicadas que existan. */
export const castFields = (row, { bools = [], numbers = [] }) => {
  if (!row) return row;
  const result = { ...row };
  for (const field of bools) if (field in result) result[field] = toBool(result[field]);
  for (const field of numbers) if (field in result) result[field] = toNumber(result[field]);
  return result;
};
