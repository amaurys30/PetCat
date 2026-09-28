import { citaCercana, inicioDeCita } from "./silencio.js";

/**
 * Catálogo de notificaciones. Cada tipo define:
 * - `correo`: roles del destinatario que reciben correo cuando no tienen un dispositivo
 *   activo ("dueno", el dueño de la mascota; "propietario", el del negocio). El resto
 *   del personal nunca recibe correo.
 * - `urgente(datos, finSilencio)`: si no puede esperar al fin del horario de silencio.
 * - `contenido(datos, rol)`: textos por nivel de detalle. `rol` es "dueno" o "negocio".
 *     titulo  — el de la push y el de la notificación en la app
 *     push    — genérico (pantalla de bloqueo): sin mascota, motivo, diagnósticos, notas ni precios
 *     mensaje — el detalle, que solo se ve dentro de la app con la sesión iniciada
 *     correo  — { asunto, parrafos }: igual de discreto que la push, más sede y dirección
 * `datos` también lleva los ids del deep link (`id_cita`, `id_negocio`), que son lo único
 * que viaja en el `data` de la push.
 */

const limpiar = (texto) => texto.replace(/[  ]/g, " ");

const fechaLegible = (fecha) =>
  limpiar(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${fecha}T12:00:00`)));

const horaLegible = (hora) =>
  limpiar(
    new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true }).format(
      new Date(`2000-01-01T${String(hora).slice(0, 5)}:00`)
    )
  );

/** "lunes, 12 de octubre a las 9:00 a. m." */
export const cuando = (fecha, hora) => `${fechaLegible(fecha)} a las ${horaLegible(hora)}`;

const mesLegible = (mes) =>
  limpiar(new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(`${mes}-15T12:00:00`)));

const donde = (d) => [d.sucursal, d.direccion].filter(Boolean).join(", ");

/** Párrafos de correo de una cita para el dueño: cuándo, dónde y qué hacer. */
const correoCitaDueno = (d, primero) => [
  primero,
  `Cuándo: ${cuando(d.fecha, d.hora_inicio)}.`,
  ...(donde(d) ? [`Dónde: ${d.negocio} — ${donde(d)}.`] : [`Negocio: ${d.negocio}.`]),
  "Si tienes preguntas o no puedes asistir, comunícate con el negocio.",
];

const urgentePorCita = (d, fin) =>
  citaCercana(fin, inicioDeCita(d.fecha, d.hora_inicio), d.fecha_anterior && inicioDeCita(d.fecha_anterior, d.hora_anterior));

export const TIPOS = {
  cita_nueva: {
    correo: ["propietario"],
    contenido: (d) => ({
      titulo: "Nueva cita por confirmar",
      push: `Hay una cita nueva para el ${cuando(d.fecha, d.hora_inicio)}. Confírmala en el panel de PetCat.`,
      mensaje: `${d.cliente} reservó ${d.servicio} para ${d.mascota} el ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal}. Queda pendiente hasta que la confirmes.`,
      correo: {
        asunto: "Tienes una cita nueva por confirmar en PetCat",
        parrafos: [
          `Llegó una reserva desde la app para el ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal}.`,
          "Queda pendiente hasta que la confirmes en el panel de PetCat. Si nadie la confirma a tiempo, se cancela sola.",
        ],
      },
    }),
  },

  cita_agendada: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Cita agendada",
      push: `${d.negocio} te agendó una cita para el ${cuando(d.fecha, d.hora_inicio)}.`,
      mensaje: `${d.negocio} agendó ${d.servicio} para ${d.mascota} el ${cuando(d.fecha, d.hora_inicio)} en ${donde(d)}.`,
      correo: { asunto: `Tu cita en ${d.negocio}`, parrafos: correoCitaDueno(d, `${d.negocio} te agendó una cita.`) },
    }),
  },

  cita_confirmada: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Cita confirmada",
      push: `${d.negocio} confirmó tu cita del ${cuando(d.fecha, d.hora_inicio)}.`,
      mensaje: `${d.negocio} confirmó la cita de ${d.mascota} (${d.servicio}) el ${cuando(d.fecha, d.hora_inicio)} en ${donde(d)}.`,
      correo: { asunto: `Tu cita en ${d.negocio} está confirmada`, parrafos: correoCitaDueno(d, `${d.negocio} confirmó tu cita.`) },
    }),
  },

  cita_cancelada: {
    correo: ["dueno"],
    urgente: urgentePorCita,
    contenido: (d, rol) =>
      rol === "dueno"
        ? {
            titulo: "Cita cancelada",
            push: `Tu cita con ${d.negocio} del ${cuando(d.fecha, d.hora_inicio)} fue cancelada. Abre PetCat para ver el detalle.`,
            mensaje: `${d.negocio} canceló la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha, d.hora_inicio)}.${d.motivo ? ` Motivo: ${d.motivo}` : ""}`,
            correo: {
              asunto: `Tu cita en ${d.negocio} fue cancelada`,
              parrafos: correoCitaDueno(d, `${d.negocio} canceló tu cita.`),
            },
          }
        : {
            titulo: "Cita cancelada",
            push: `Se canceló una cita del ${cuando(d.fecha, d.hora_inicio)}.`,
            mensaje: `${d.cliente} canceló la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha, d.hora_inicio)}.${d.tardia ? " Fue una cancelación tardía." : ""}${d.motivo ? ` Motivo: ${d.motivo}` : ""}`,
          },
  },

  cita_reprogramada: {
    correo: ["dueno"],
    urgente: urgentePorCita,
    contenido: (d, rol) =>
      rol === "dueno"
        ? {
            titulo: "Cita reprogramada",
            push: `Tu cita con ${d.negocio} cambió al ${cuando(d.fecha, d.hora_inicio)}.`,
            mensaje: `${d.negocio} movió la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha_anterior, d.hora_anterior)} al ${cuando(d.fecha, d.hora_inicio)} en ${donde(d)}.${d.motivo ? ` Motivo: ${d.motivo}` : ""}`,
            correo: {
              asunto: `Tu cita en ${d.negocio} cambió de fecha`,
              parrafos: correoCitaDueno(d, `${d.negocio} cambió tu cita del ${cuando(d.fecha_anterior, d.hora_anterior)} a una nueva fecha.`),
            },
          }
        : {
            titulo: "Cita reprogramada",
            push: `Una cita se movió al ${cuando(d.fecha, d.hora_inicio)}.`,
            mensaje: `${d.cliente} movió la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha_anterior, d.hora_anterior)} al ${cuando(d.fecha, d.hora_inicio)}. Queda pendiente de confirmar.`,
          },
  },

  plan_limite_alcanzado: {
    correo: [],
    contenido: (d) => ({
      titulo: "Límite de citas del plan",
      push: `Se rechazó una reserva: tu negocio alcanzó las ${d.maximo} citas de ${mesLegible(d.mes)} de su plan.`,
      mensaje: `Tu negocio alcanzó las ${d.maximo} citas de ${mesLegible(d.mes)} del plan ${d.plan} y la app ya no muestra horarios de ese mes. Mejora tu plan para seguir recibiendo reservas.`,
    }),
  },

  plan_limite_80: {
    correo: [],
    contenido: (d) => ({
      titulo: "Te quedan pocas citas este mes",
      push: `Tu negocio lleva ${d.usadas} de ${d.maximo} citas de ${mesLegible(d.mes)} de su plan.`,
      mensaje: `Tu negocio lleva ${d.usadas} de las ${d.maximo} citas de ${mesLegible(d.mes)} que permite el plan ${d.plan}. Al llegar al límite, la app deja de mostrar horarios. Considera mejorar tu plan.`,
    }),
  },
};

export const TIPOS_NOTIFICACION = Object.keys(TIPOS);
