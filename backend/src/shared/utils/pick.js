/**
 * Copia de `obj` solo con los campos permitidos y definidos. Base de los UPDATE
 * dinámicos: los nombres de columna salen de la lista blanca, nunca del usuario.
 *
 *   const cambios = pick(req.body, ["nombre", "telefono", "id_rol"]);
 */
export const pick = (obj, allowed) => {
  const result = {};
  if (!obj) return result;
  for (const key of allowed) {
    if (Object.hasOwn(obj, key) && obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
};

export default pick;
