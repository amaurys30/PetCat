import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { configSilencio } from "../notificaciones/notificacion.service.js";
import { enSilencio, finDelSilencio } from "../notificaciones/silencio.js";

/**
 * Plazo del negocio para confirmar una cita pendiente (2.5). Al vencer, el job de
 * confirmaciones la cancela (cancelada_por = 'sistema').
 */

const MINUTO = 60_000;
// Si el plazo cae de madrugada se corre hasta esta hora después del fin del silencio...
export const TRAS_SILENCIO_MIN = 60;
// ...pero nunca más tarde que estos minutos antes del inicio de la cita.
export const TOPE_ANTES_INICIO_MIN = 30;

/** Configuración del plazo: horas, minutos antes del inicio y horario de silencio. */
export const configConfirmacion = async () => ({
  plazoH: await configuracionRepo.getValor("plazo_confirmacion_h", 24),
  antesInicioMin: await configuracionRepo.getValor("confirmacion_antes_inicio_min", 60),
  silencio: await configSilencio(),
});

/**
 * Lo que ocurra primero entre `creacion` + `plazoH` e `inicio` − `antesInicioMin`. Si ese
 * momento cae entre el inicio del silencio y su fin + 60 min (nadie confirma de
 * madrugada), se corre al fin del silencio + 60 min, sin pasar de `inicio` − 30 min.
 * La ventana llega hasta el fin + 60 (y no solo al fin) para que la regla sea monótona:
 * un plazo de 06:59 no debe terminar después que uno de 07:15. Nunca antes de `creacion`.
 * @param {{ creacion: Date, inicio: Date, plazoH: number, antesInicioMin: number,
 *   silencio: { inicio: number, fin: number } }} p  Silencio en minutos del día
 * @returns {Date}
 */
export const calcularPlazoConfirmacion = ({ creacion, inicio, plazoH, antesInicioMin, silencio }) => {
  let plazo = new Date(Math.min(creacion.getTime() + plazoH * 60 * MINUTO, inicio.getTime() - antesInicioMin * MINUTO));
  if (silencio.inicio !== silencio.fin) {
    const ventana = { inicio: silencio.inicio, fin: (silencio.fin + TRAS_SILENCIO_MIN) % 1440 };
    if (enSilencio(plazo, ventana)) {
      const corrido = finDelSilencio(plazo, ventana);
      plazo = new Date(Math.min(corrido.getTime(), inicio.getTime() - TOPE_ANTES_INICIO_MIN * MINUTO));
    }
  }
  return new Date(Math.max(plazo.getTime(), creacion.getTime()));
};
