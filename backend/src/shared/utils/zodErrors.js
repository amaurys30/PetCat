/**
 * Convierte los issues de un ZodError en { campo: "mensaje" }, con el primer
 * mensaje de cada campo. Los campos anidados usan punto: "direccion.ciudad".
 * Las llaves no permitidas (z.strictObject) se reportan cada una en su campo.
 */
export const formatZodError = (error) => {
  const errors = {};
  const add = (path, message) => {
    const field = path.length > 0 ? path.join(".") : "_";
    if (!(field in errors)) errors[field] = message;
  };

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) add([...issue.path, key], "Campo no permitido");
    } else {
      add(issue.path, issue.message);
    }
  }
  return errors;
};
