import { readFileSync } from "node:fs";

/**
 * Divide un script SQL en sentencias, como lo haría el cliente `mysql`:
 * respeta `DELIMITER` (triggers con `$$`), strings ('', "", ``) y comentarios
 * (--, #, /* *\/), que se descartan. Así se puede cargar petcat.sql con mysql2
 * sin depender del cliente de línea de comandos.
 */
export const splitSqlStatements = (sql) => {
  const statements = [];
  const delimiterRe = /[ \t\r\n]*DELIMITER[ \t]+(\S+)[^\n]*(?:\n|$)/iy;
  let delimiter = ";";
  let current = "";
  let i = 0;

  const push = () => {
    const stmt = current.trim();
    if (stmt) statements.push(stmt);
    current = "";
  };

  while (i < sql.length) {
    // `DELIMITER` solo es válido al inicio de una sentencia.
    if (current.trim() === "") {
      delimiterRe.lastIndex = i;
      const match = delimiterRe.exec(sql);
      if (match) {
        delimiter = match[1];
        current = "";
        i = delimiterRe.lastIndex;
        continue;
      }
    }

    const c = sql[i];
    const next = sql[i + 1];

    // Comentarios de línea: "-- " (con espacio o fin de línea) y "#".
    if ((c === "-" && next === "-" && /[\s]|^$/.test(sql[i + 2] ?? "")) || c === "#") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }

    // Comentario de bloque.
    if (c === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += " ";
      continue;
    }

    // Strings e identificadores entre comillas: se copian tal cual.
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "\\" && c !== "`") {
          j += 2;
        } else if (sql[j] === c && sql[j + 1] === c) {
          j += 2;
        } else if (sql[j] === c) {
          break;
        } else {
          j += 1;
        }
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (sql.startsWith(delimiter, i)) {
      push();
      i += delimiter.length;
      continue;
    }

    current += c;
    i += 1;
  }

  push();
  return statements;
};

/**
 * Ejecuta un archivo .sql sentencia por sentencia en `conn` (una conexión mysql2).
 * `replaceDbName` cambia `petcat_db` por otra base (p. ej. petcat_test).
 */
export const runSqlFile = async (conn, filePath, { replaceDbName } = {}) => {
  let sql = readFileSync(filePath, "utf8");
  if (replaceDbName) sql = sql.replace(/\bpetcat_db\b/g, replaceDbName);

  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      err.message = `${err.message}\nEn ${filePath}, sentencia:\n${stmt.slice(0, 300)}`;
      throw err;
    }
  }
  return statements.length;
};
