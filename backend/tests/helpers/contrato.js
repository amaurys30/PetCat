import { appendFileSync } from "node:fs";
import swaggerSpec, { resolverRespuesta } from "../../src/docs/swagger.js";

/**
 * Contrato de Swagger: cada respuesta 2xx de los tests se compara con el esquema
 * documentado de su ruta, y falla si falta un campo marcado como requerido (ver
 * `marcarRequeridos` en src/docs/swagger.js). Solo comprueba presencia: un campo
 * requerido puede venir en null si su esquema lo permite.
 *
 * Con CONTRATO_INFORME=<archivo> anota las diferencias en ese archivo en lugar de fallar
 * (útil para revisar la documentación de una vez). Con CONTRATO_COBERTURA=<archivo> anota
 * cada operación verificada, para ver cuáles no cubre ningún test.
 */

const esquemas = swaggerSpec.components.schemas;

// Plantillas de Swagger como expresiones regulares; las literales primero
// (`/negocios/mios` gana sobre `/negocios/{id_negocio}`).
const rutas = Object.keys(swaggerSpec.paths)
  .map((plantilla) => ({
    plantilla,
    regex: new RegExp(`^${plantilla.replace(/\{[^}]+\}/g, "[^/]+")}$`),
    parametros: (plantilla.match(/\{/g) ?? []).length,
  }))
  .sort((a, b) => a.parametros - b.parametros);

const resolver = (esquema) =>
  esquema?.$ref ? resolver(esquemas[esquema.$ref.split("/").pop()]) : esquema;

/** Rutas (con punto) de los campos requeridos que faltan en `valor`. */
const faltantes = (valor, esquema, ruta) => {
  esquema = resolver(esquema);
  if (!esquema || valor === null || valor === undefined) return [];
  if (esquema.allOf) return esquema.allOf.flatMap((parte) => faltantes(valor, parte, ruta));
  const alternativas = esquema.oneOf ?? esquema.anyOf;
  if (alternativas) {
    const resultados = alternativas.map((parte) => faltantes(valor, parte, ruta));
    return resultados.some((r) => r.length === 0) ? [] : resultados[0];
  }
  if (Array.isArray(valor)) {
    return esquema.items ? valor.flatMap((item, i) => faltantes(item, esquema.items, `${ruta}[${i}]`)) : [];
  }
  if (typeof valor !== "object") return [];

  const errores = (esquema.required ?? [])
    .filter((campo) => !Object.hasOwn(valor, campo))
    .map((campo) => `${ruta}.${campo}`);
  for (const [campo, propiedad] of Object.entries(esquema.properties ?? {})) {
    if (Object.hasOwn(valor, campo)) errores.push(...faltantes(valor[campo], propiedad, `${ruta}.${campo}`));
  }
  if (esquema.additionalProperties && typeof esquema.additionalProperties === "object") {
    for (const [campo, v] of Object.entries(valor)) {
      if (!esquema.properties?.[campo]) {
        errores.push(...faltantes(v, esquema.additionalProperties, `${ruta}.${campo}`));
      }
    }
  }
  return errores;
};

export const verificarContrato = (metodo, url, res) => {
  if (res.status < 200 || res.status >= 300) return;
  if (!res.headers["content-type"]?.includes("application/json")) return;

  const camino = url.split("?")[0];
  const ruta = rutas.find((r) => r.regex.test(camino) && swaggerSpec.paths[r.plantilla][metodo]);
  const operacion = ruta && swaggerSpec.paths[ruta.plantilla][metodo];
  const nombre = `${metodo.toUpperCase()} ${ruta?.plantilla ?? camino}`;
  if (!operacion) throw new Error(`Contrato: ${nombre} no está documentado en Swagger`);

  const documentada = operacion.responses?.[res.status] ?? operacion.responses?.["2XX"];
  if (!documentada) throw new Error(`Contrato: ${nombre} no documenta la respuesta ${res.status}`);
  const esquema = resolverRespuesta(swaggerSpec, documentada)?.content?.["application/json"]?.schema;
  if (!esquema) throw new Error(`Contrato: ${nombre} no documenta el cuerpo de la respuesta ${res.status}`);

  if (process.env.CONTRATO_COBERTURA) appendFileSync(process.env.CONTRATO_COBERTURA, `${nombre}\n`);
  const errores = faltantes(res.body, esquema, "body");
  if (errores.length === 0) return;
  const mensaje = `Contrato: ${nombre} (${res.status}) no trae campos requeridos en Swagger: ${errores
    .slice(0, 10)
    .join(", ")}${errores.length > 10 ? ` y ${errores.length - 10} más` : ""}`;
  if (process.env.CONTRATO_INFORME) {
    appendFileSync(process.env.CONTRATO_INFORME, `${nombre}\t${res.status}\t${errores.join(" ")}\n`);
    return;
  }
  throw new Error(mensaje);
};
