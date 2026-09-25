
export const hasPermission = (permisos, modulo, accion) => {
  if (!permisos) return false;

  try {
    const parsed = typeof permisos === "string"
      ? JSON.parse(permisos)
      : permisos;

    return parsed[modulo]?.includes(accion) || false;
  } catch (error) {
    return false;
  }
};
