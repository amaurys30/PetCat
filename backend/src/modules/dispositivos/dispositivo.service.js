import * as dispositivoRepo from "./dispositivo.repository.js";
import { castFields } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const formatDispositivo = ({ id_dispositivo, token_expo, plataforma, nombre, activo, fecha_registro }) =>
  castFields({ id_dispositivo, token_expo, plataforma, nombre, activo, fecha_registro }, { bools: ["activo"] });

/**
 * La app registra su token de Expo después del login. Queda ligado a la sesión: al
 * cerrarla (logout, cambio o restablecimiento de contraseña) deja de recibir push.
 * Devuelve { dispositivo, nuevo }.
 */
export const registrar = async (id_usuario, id_sesion, data) => {
  const nuevo = await dispositivoRepo.upsert({ id_usuario, id_sesion, ...data });
  return { dispositivo: formatDispositivo(await dispositivoRepo.findByToken(data.token_expo)), nuevo };
};

export const quitar = async (id_usuario, token_expo) => {
  if (!(await dispositivoRepo.desactivarDeUsuario(id_usuario, token_expo))) {
    throw ApiError.notFound("Dispositivo no encontrado");
  }
};
