/**
 * Piezas de SQL que se repiten entre repositorios. Nunca reciben nombres de
 * columna del usuario: solo valores que van como parámetros (?).
 */

/** Patrón de LIKE que busca el texto literal: % y _ son comodines y se escapan. */
export const likeLiteral = (texto) => `%${texto.replace(/[\\%_]/g, "\\$&")}%`;
