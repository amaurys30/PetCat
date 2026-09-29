import { spawn } from "node:child_process";

/**
 * Corre `cuerpo` en otro proceso de Node, con su propio pool de conexiones, como una segunda
 * instancia de la API. `cuerpo` es código ESM (puede usar `await import(...)` desde la raíz
 * del backend) y termina con `return <valor serializable>`, que es lo que devuelve la promesa.
 * Sirve para comprobar que un job no duplica trabajo con dos instancias a la vez.
 */
export const enOtroProceso = (cuerpo) =>
  new Promise((resolve, reject) => {
    const script = `
      const { pool } = await import("./src/config/db.js");
      const resultado = await (async () => { ${cuerpo} })();
      console.log(JSON.stringify(resultado ?? null));
      await pool.end();`;
    const hijo = spawn(process.execPath, ["--input-type=module", "-e", script], { cwd: process.cwd(), env: process.env });
    let salida = "";
    let errores = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (errores += d));
    hijo.on("close", (codigo) =>
      codigo === 0 ? resolve(JSON.parse(salida.trim().split("\n").pop())) : reject(new Error(errores || `salida ${codigo}`))
    );
  });
