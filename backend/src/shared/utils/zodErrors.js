/**
 * Convierte los issues de un ZodError en { campo: "mensaje" }, con el primer
 * mensaje de cada campo. Los campos anidados usan punto: "direccion.ciudad".
 */
export const formatZodError = (error) => {
  const errors = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
};
