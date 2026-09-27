/**
 * Cálculo de la disponibilidad de un empleado, sin acceso a la base: recibe los
 * datos ya cargados y devuelve rangos. Lo usan la disponibilidad efectiva, las
 * `citas_afectadas` y (en 1.5) los horarios libres para reservar.
 *
 * Los rangos se manejan en minutos desde la medianoche: { inicio, fin }, con
 * `fin` exclusivo (08:00–12:00 = { inicio: 480, fin: 720 }).
 */

const DIA_COMPLETO = { inicio: 0, fin: 24 * 60 };

const dosDigitos = (n) => String(n).padStart(2, "0");

/** "08:30" o "08:30:00" -> 510. */
export const aMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

/** 510 -> "08:30"; 1440 -> "24:00" (fin del día). */
export const aHora = (minutos) => `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;

/** 0 = domingo ... 6 = sábado, para una fecha "YYYY-MM-DD" (sin depender de la zona horaria). */
export const diaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

/** Ordena y une los rangos que se cruzan o se tocan. */
export const normalizar = (rangos) => {
  const ordenados = rangos.filter((r) => r.fin > r.inicio).sort((a, b) => a.inicio - b.inicio);
  const unidos = [];
  for (const rango of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && rango.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, rango.fin);
    else unidos.push({ ...rango });
  }
  return unidos;
};

export const union = (a, b) => normalizar([...a, ...b]);

export const interseccion = (a, b) => {
  const resultado = [];
  for (const x of a) {
    for (const y of b) {
      const inicio = Math.max(x.inicio, y.inicio);
      const fin = Math.min(x.fin, y.fin);
      if (fin > inicio) resultado.push({ inicio, fin });
    }
  }
  return normalizar(resultado);
};

/** `a` menos todos los rangos de `b`. */
export const resta = (a, b) => {
  let resultado = normalizar(a);
  for (const quitar of b) {
    resultado = resultado.flatMap((r) => {
      if (quitar.fin <= r.inicio || quitar.inicio >= r.fin) return [r];
      const partes = [];
      if (quitar.inicio > r.inicio) partes.push({ inicio: r.inicio, fin: quitar.inicio });
      if (quitar.fin < r.fin) partes.push({ inicio: quitar.fin, fin: r.fin });
      return partes;
    });
  }
  return resultado;
};

/** El bloque [inicio, fin) cabe entero dentro de uno de los rangos. */
export const cabeEn = (rangos, inicio, fin) => rangos.some((r) => r.inicio <= inicio && fin <= r.fin);

const rangoDe = (inicio, fin) => ({ inicio: aMinutos(inicio), fin: aMinutos(fin) });

/** La excepción aplica a la fecha: fecha_especifica <= fecha <= fecha_fin (o solo fecha_especifica). */
const cubre = (excepcion, fecha) =>
  excepcion.fecha_especifica <= fecha && fecha <= (excepcion.fecha_fin ?? excepcion.fecha_especifica);

/** Rangos que restan un bloqueo o una vacación (sin horas = día completo). */
const rangosQueRestan = (excepciones, fecha) =>
  excepciones
    .filter((e) => (e.tipo === "bloqueo" || e.tipo === "vacacion") && cubre(e, fecha))
    .map((e) => (e.tipo === "bloqueo" && e.hora_inicio ? rangoDe(e.hora_inicio, e.hora_fin) : DIA_COMPLETO));

/**
 * Disponibilidad de un empleado en una sucursal y una fecha:
 * 1. base: su `horario_normal` de ese día (de esa sucursal o con sucursal null),
 *    recortado por el horario de la sucursal; sin ningún `horario_normal` en la
 *    semana, el horario de la sucursal;
 * 2. se restan sus eventos especiales de ese día en otra sucursal (el evento manda);
 * 3. se suman sus eventos especiales en esta sucursal, sin recortarlos por el horario de la sucursal;
 * 4. se restan bloqueos y vacaciones, también sobre los eventos.
 *
 * @param {object} datos
 * @param {string} datos.fecha "YYYY-MM-DD"
 * @param {number} datos.id_sucursal
 * @param {{ dia_semana, hora_apertura, hora_cierre }[]} datos.horarioSucursal Rangos de la sucursal (toda la semana)
 * @param {{ dia_semana, hora_inicio, hora_fin, id_sucursal }[]} datos.horarioSemanal `horario_normal` del empleado (toda la semana)
 * @param {{ tipo, fecha_especifica, fecha_fin, hora_inicio, hora_fin, id_sucursal }[]} datos.excepciones Bloqueos, vacaciones y eventos activos
 * @returns {{ inicio: number, fin: number }[]}
 */
export const calcularDisponibilidad = ({ fecha, id_sucursal, horarioSucursal, horarioSemanal, excepciones }) => {
  const dia = diaSemana(fecha);
  const sucursal = normalizar(
    horarioSucursal.filter((h) => h.dia_semana === dia).map((h) => rangoDe(h.hora_apertura, h.hora_cierre))
  );

  const base =
    horarioSemanal.length === 0
      ? sucursal
      : interseccion(
          horarioSemanal
            .filter((h) => h.dia_semana === dia && (h.id_sucursal === null || h.id_sucursal === id_sucursal))
            .map((h) => rangoDe(h.hora_inicio, h.hora_fin)),
          sucursal
        );

  const eventos = excepciones.filter((e) => e.tipo === "evento_especial" && cubre(e, fecha));
  const eventosAqui = eventos.filter((e) => e.id_sucursal === id_sucursal).map((e) => rangoDe(e.hora_inicio, e.hora_fin));
  const eventosEnOtra = eventos.filter((e) => e.id_sucursal !== id_sucursal).map((e) => rangoDe(e.hora_inicio, e.hora_fin));

  return resta(union(resta(base, eventosEnOtra), eventosAqui), rangosQueRestan(excepciones, fecha));
};

/**
 * La cita cabe en la disponibilidad del empleado. Una cita sin sucursal solo se
 * comprueba contra bloqueos y vacaciones.
 * @param {{ fecha, hora_inicio, hora_fin, id_sucursal }} cita
 * @param {{ horariosPorSucursal: Record<number, object[]>, horarioSemanal, excepciones }} datos
 */
export const citaCabe = (cita, { horariosPorSucursal, horarioSemanal, excepciones }) => {
  const bloque = rangoDe(cita.hora_inicio, cita.hora_fin);
  if (cita.id_sucursal === null) {
    return interseccion([bloque], rangosQueRestan(excepciones, cita.fecha)).length === 0;
  }
  const rangos = calcularDisponibilidad({
    fecha: cita.fecha,
    id_sucursal: cita.id_sucursal,
    horarioSucursal: horariosPorSucursal[cita.id_sucursal] ?? [],
    horarioSemanal,
    excepciones,
  });
  return cabeEn(rangos, bloque.inicio, bloque.fin);
};

/** Rangos en formato de la API: [{ hora_inicio: "08:00", hora_fin: "12:00" }]. */
export const comoHoras = (rangos) => rangos.map((r) => ({ hora_inicio: aHora(r.inicio), hora_fin: aHora(r.fin) }));
