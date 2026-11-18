import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import * as codigoRepo from "./codigo.repository.js";
import { env } from "../../config/env.js";

// Códigos de 6 dígitos de los correos de verificación y recuperación (para la app, que no
// abre los enlaces del panel web). El código nunca se guarda ni se registra: la base tiene
// su HMAC, ligado al usuario y al tipo, y la comparación es en tiempo constante.

export const MINUTOS_CODIGO = 15;
export const MAX_INTENTOS_CODIGO = 5;
/** Correos con código por cuenta y tipo: uno por minuto y cinco por hora. */
export const CODIGOS_POR_MINUTO = 1;
export const CODIGOS_POR_HORA = 5;

const hmac = (id_usuario, tipo, codigo) =>
  createHmac("sha256", env.CODIGO_SECRET).update(`${id_usuario}:${tipo}:${codigo}`).digest();

/**
 * Límite de correos con código de la cuenta: "minuto", "hora" o null si se puede enviar otro.
 * Bloquea la fila del usuario hasta el final de la transacción, así dos solicitudes
 * simultáneas no pasan las dos el límite.
 */
export const limiteAlcanzado = async (id_usuario, tipo, conn) => {
  await codigoRepo.lockUsuario(id_usuario, conn);
  const { ultimoMinuto, ultimaHora } = await codigoRepo.contarRecientes(id_usuario, tipo, conn);
  if (ultimoMinuto >= CODIGOS_POR_MINUTO) return "minuto";
  if (ultimaHora >= CODIGOS_POR_HORA) return "hora";
  return null;
};

/** Cierra el código anterior del mismo tipo y crea uno nuevo. Devuelve el código (solo para el correo). */
export const emitir = async (id_usuario, tipo, conn) => {
  await codigoRepo.cerrarAbiertos(id_usuario, tipo, "reemplazado", conn);
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await codigoRepo.crear(
    { id_usuario, tipo, codigo_hash: hmac(id_usuario, tipo, codigo).toString("hex"), minutos: MINUTOS_CODIGO },
    conn
  );
  return codigo;
};

/**
 * Comprueba el código contra el vigente del usuario. Si coincide, lo cierra (usado); si no,
 * suma un intento y, al quinto, lo cierra. Devuelve true o false: quien llama decide el error
 * después del commit, para que el intento fallido quede guardado.
 */
export const comprobar = async (id_usuario, tipo, codigo, conn) => {
  const vigente = await codigoRepo.findVigenteForUpdate(id_usuario, tipo, conn);
  const recibido = hmac(id_usuario, tipo, codigo);
  if (!vigente) {
    // Misma operación que con un código guardado, para no responder más rápido.
    timingSafeEqual(recibido, recibido);
    return false;
  }
  if (timingSafeEqual(Buffer.from(vigente.codigo_hash, "hex"), recibido)) {
    await codigoRepo.cerrar(vigente.id_codigo, "usado", conn);
    return true;
  }
  await codigoRepo.sumarIntento(vigente.id_codigo, MAX_INTENTOS_CODIGO, conn);
  return false;
};

/** Sin cuenta a la que comparar (email inexistente o inactivo): mismo trabajo que `comprobar`. */
export const comprobarSinCuenta = (codigo) => {
  const recibido = hmac(0, "recuperacion", codigo);
  timingSafeEqual(recibido, recibido);
  return false;
};

export const cerrarAbiertos = codigoRepo.cerrarAbiertos;
