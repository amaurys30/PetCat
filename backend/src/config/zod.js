import { z } from "zod";

/**
 * Mensajes de validación en español para toda la API. Se importa una vez en app.js.
 * Los casos más frecuentes llevan un mensaje propio; el resto usa el idioma "es" de Zod.
 * Un mensaje definido en el esquema (`z.string().min(3, "...")`) siempre tiene prioridad.
 */
const limitMessage = (issue, word) => {
  const n = Number(issue.maximum ?? issue.minimum);
  switch (issue.origin) {
    case "string":
      return `${word} ${n} ${n === 1 ? "carácter" : "caracteres"}`;
    case "array":
    case "set":
      return `${word} ${n} ${n === 1 ? "elemento" : "elementos"}`;
    case "number":
    case "int":
    case "bigint":
      return `Debe ser ${issue.code === "too_big" ? "menor" : "mayor"} o igual a ${n}`;
    default:
      return undefined;
  }
};

z.config(z.locales.es());
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "invalid_type":
        if (issue.input === undefined) return "Campo obligatorio";
        if (issue.expected === "int") return "Debe ser un número entero";
        if (issue.expected === "number") return "Debe ser un número";
        return undefined;
      case "invalid_format":
        return issue.format === "email" ? "Correo electrónico inválido" : undefined;
      case "too_big":
        return limitMessage(issue, "Máximo");
      case "too_small":
        return limitMessage(issue, "Mínimo");
      default:
        return undefined;
    }
  },
});
