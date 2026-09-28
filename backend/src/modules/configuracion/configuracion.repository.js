import db from "../../config/db.js";

const convertir = (valor, tipo) => {
  switch (tipo) {
    case "integer":
    case "decimal":
      return Number(valor);
    case "boolean":
      return valor === "true";
    case "json":
      return JSON.parse(valor);
    default:
      return valor;
  }
};

/**
 * Valor de `configuracion_global` convertido según su columna `tipo`, o
 * `porDefecto` si la clave no existe o no es un número válido.
 */
export const getValor = async (clave, porDefecto) => {
  const [rows] = await db.query("SELECT valor, tipo FROM configuracion_global WHERE clave = ?", [clave]);
  if (!rows[0]) return porDefecto;
  const valor = convertir(rows[0].valor, rows[0].tipo);
  return typeof valor === "number" && !Number.isFinite(valor) ? porDefecto : valor;
};
