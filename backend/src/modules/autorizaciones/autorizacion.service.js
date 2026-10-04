import * as configuracionRepo from "../configuracion/configuracion.repository.js";

/** Versión vigente de la política de datos que acepta el titular. */
export const versionPolitica = () => configuracionRepo.getValor("terminos_version", "1.0");

/** Versión vigente y enlace al texto completo (null si PetCat todavía no lo publicó). */
export const getPoliticaVigente = async () => {
  const [version, url] = await Promise.all([
    versionPolitica(),
    configuracionRepo.getValor("politica_datos_url", ""),
  ]);
  return { version, url: url || null };
};
