import { citaCercana, inicioDeCita } from "./silencio.js";

/**
 * Catálogo de notificaciones. Cada tipo define:
 * - `correo`: roles del destinatario que reciben correo cuando no tienen un dispositivo
 *   activo ("dueno", el dueño de la mascota; "propietario", el del negocio). El resto
 *   del personal nunca recibe correo.
 * - `urgente(datos, finSilencio)`: si no puede esperar al fin del horario de silencio.
 * - `soporte`: notificar() agrega a `datos.soporte` el contacto de soporte ({ email, whatsapp }).
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

/** "9:00 a. m." */
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

/** Texto libre del negocio con punto final, para que no se pegue a la frase siguiente. */
const conPunto = (texto) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`);

/** Párrafos de correo de una cita para el dueño: cuándo, dónde, indicaciones (si hay) y qué hacer. */
const correoCitaDueno = (d, primero, indicaciones = null) => [
  primero,
  `Cuándo: ${cuando(d.fecha, d.hora_inicio)}.`,
  ...(donde(d) ? [`Dónde: ${d.negocio} — ${donde(d)}.`] : [`Negocio: ${d.negocio}.`]),
  ...(indicaciones ? [`Indicaciones del negocio: ${conPunto(indicaciones)}`] : []),
  "Si tienes preguntas o no puedes asistir, comunícate con el negocio.",
];

/**
 * Cómo comunicarse con PetCat según soporte_email y soporte_whatsapp, o null si ninguno
 * está configurado (la línea se omite).
 */
export const lineaSoporte = (soporte) => {
  const { email, whatsapp } = soporte ?? {};
  if (email && whatsapp) return `Escríbenos a ${email} o por WhatsApp al ${whatsapp}.`;
  if (email) return `Escríbenos a ${email}.`;
  if (whatsapp) return `Escríbenos por WhatsApp al ${whatsapp}.`;
  return null;
};

/** Los párrafos con la línea de contacto al final, si hay contacto configurado. */
const conSoporte = (parrafos, soporte) => {
  const linea = lineaSoporte(soporte);
  return linea ? [...parrafos, linea] : parrafos;
};

/** Párrafos de correo de un recordatorio de vacuna (sin mascota ni vacuna, como la push). */
const correoVacuna = (primero) => [
  primero,
  "Agenda la aplicación con tu veterinaria para mantener su protección al día.",
  "El detalle está en el carnet de vacunas de la app PetCat.",
];

const urgentePorCita = (d, fin) =>
  citaCercana(fin, inicioDeCita(d.fecha, d.hora_inicio), d.fecha_anterior && inicioDeCita(d.fecha_anterior, d.hora_anterior));

export const TIPOS = {
  // `d.confirmada`: el negocio tiene la confirmación automática (2.5) y la cita ya nació confirmada.
  cita_nueva: {
    correo: ["propietario"],
    contenido: (d) =>
      d.confirmada
        ? {
            titulo: "Nueva cita confirmada",
            push: `Hay una cita nueva para el ${cuando(d.fecha, d.hora_inicio)}. Quedó confirmada automáticamente.`,
            mensaje: `${d.cliente} reservó ${d.servicio} para ${d.mascota} el ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal}. Quedó confirmada automáticamente.`,
            correo: {
              asunto: "Tienes una cita nueva en PetCat",
              parrafos: [
                `Llegó una reserva desde la app para el ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal}.`,
                "Quedó confirmada automáticamente. Puedes verla en la agenda del panel de PetCat.",
              ],
            },
          }
        : {
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
          },
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
            mensaje: `${d.cliente} movió la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha_anterior, d.hora_anterior)} al ${cuando(d.fecha, d.hora_inicio)}. ${d.confirmada ? "Quedó confirmada automáticamente." : "Queda pendiente de confirmar."}`,
          },
  },

  // Job de confirmaciones (2.5). `d.plazo`: confirmar_antes_de ("YYYY-MM-DD HH:MM:SS").
  // Aviso de mitad de plazo al negocio: nunca urgente (nadie confirma citas de madrugada).
  cita_por_confirmar: {
    correo: ["propietario"],
    contenido: (d) => {
      const [fechaPlazo, horaPlazo] = d.plazo.split(" ");
      const antesDe = cuando(fechaPlazo, horaPlazo);
      return {
        titulo: "Cita sin confirmar",
        push: `Una cita del ${cuando(d.fecha, d.hora_inicio)} sigue sin confirmar. Se cancela sola si no la confirmas.`,
        mensaje: `La cita de ${d.cliente} (${d.servicio} para ${d.mascota}) del ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal} sigue sin confirmar. Si no la confirmas antes del ${antesDe}, se cancelará sola.`,
        correo: {
          asunto: "Tienes una cita sin confirmar en PetCat",
          parrafos: [
            `Una cita del ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal} sigue sin confirmar.`,
            `Si nadie la confirma en el panel de PetCat antes del ${antesDe}, se cancelará sola.`,
          ],
        },
      };
    },
  },

  // Cancelación automática: al dueño (con los ids para reservar de nuevo; urgente si la cita
  // está cerca, `d.destino === "dueno"`) y al negocio.
  cita_no_confirmada: {
    correo: ["dueno", "propietario"],
    urgente: (d, fin) => d.destino === "dueno" && urgentePorCita(d, fin),
    contenido: (d, rol) =>
      rol === "dueno"
        ? {
            titulo: "Tu cita se canceló",
            push: `Tu cita con ${d.negocio} del ${cuando(d.fecha, d.hora_inicio)} se canceló porque el negocio no la confirmó a tiempo.`,
            mensaje: `${d.negocio} no confirmó a tiempo la cita de ${d.mascota} (${d.servicio}) del ${cuando(d.fecha, d.hora_inicio)} y se canceló. No tienes que hacer nada. Puedes reservar de nuevo desde la app.`,
            correo: {
              asunto: `Tu cita en ${d.negocio} se canceló`,
              parrafos: [
                `${d.negocio} no confirmó a tiempo tu cita y se canceló.`,
                `Era para el ${cuando(d.fecha, d.hora_inicio)}.`,
                "No tienes que hacer nada. Puedes reservar de nuevo en la app PetCat.",
              ],
            },
          }
        : {
            titulo: "Cita cancelada sin confirmar",
            push: `Se canceló una cita del ${cuando(d.fecha, d.hora_inicio)}: nadie la confirmó a tiempo.`,
            mensaje: `La cita de ${d.cliente} (${d.servicio} para ${d.mascota}) del ${cuando(d.fecha, d.hora_inicio)} se canceló porque nadie la confirmó a tiempo. Con la confirmación automática del negocio, las citas de la app quedan confirmadas al reservar.`,
            correo: {
              asunto: "Se canceló una cita sin confirmar en PetCat",
              parrafos: [
                `La cita del ${cuando(d.fecha, d.hora_inicio)} en ${d.sucursal} se canceló porque nadie la confirmó a tiempo.`,
                "Con la confirmación automática del negocio (en su configuración), las citas de la app quedan confirmadas al reservar.",
              ],
            },
          },
  },

  // Recordatorios de la 2.4 (job de recordatorios de citas).
  cita_dia_anterior: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Tu cita es mañana",
      push: `Mañana a las ${horaLegible(d.hora_inicio)} tienes una cita con ${d.negocio}.`,
      mensaje: [
        `Mañana, ${cuando(d.fecha, d.hora_inicio)}, ${d.mascota} tiene ${d.servicio} en ${d.negocio} (${donde(d)}).`,
        ...(d.indicaciones ? [`Indicaciones del negocio: ${conPunto(d.indicaciones)}`] : []),
        "Si no puedes asistir, cancela o reprograma desde la app.",
      ].join(" "),
      // Las indicaciones son del servicio (no de la mascota): van en el correo, no en la push.
      correo: {
        asunto: `Recordatorio: tu cita de mañana en ${d.negocio}`,
        parrafos: correoCitaDueno(d, "Te recordamos tu cita de mañana.", d.indicaciones),
      },
    }),
  },

  cita_recordatorio: {
    correo: ["dueno"],
    // Una cita temprana (antes del fin del silencio + 3 h) no puede esperar al fin del silencio.
    urgente: (d, fin) => citaCercana(fin, inicioDeCita(d.fecha, d.hora_inicio)),
    contenido: (d) => ({
      titulo: "Tu cita es pronto",
      push: `Hoy a las ${horaLegible(d.hora_inicio)} tienes una cita con ${d.negocio}.`,
      mensaje: `${d.mascota} tiene ${d.servicio} hoy a las ${horaLegible(d.hora_inicio)} en ${d.negocio} (${donde(d)}).`,
      correo: {
        asunto: `Tu cita en ${d.negocio} es hoy`,
        parrafos: correoCitaDueno(d, "Te recordamos tu cita de hoy."),
      },
    }),
  },

  // Reseñas (2.6). La push no lleva el comentario ni la mascota.
  // Invitación al dueño unas horas después de completada la cita (job, fuera de 20:00-10:00).
  // Sin correo: sin la app no se puede reseñar. `d.resenar_antes_de`: fin del plazo.
  resena_invitacion: {
    correo: [],
    contenido: (d) => {
      const [fechaPlazo, horaPlazo] = d.resenar_antes_de.split(" ");
      return {
        titulo: `¿Cómo te fue en ${d.negocio}?`,
        push: `Cuéntanos cómo te fue en ${d.negocio}. Tu reseña ayuda a otros dueños de mascotas.`,
        mensaje: `${d.mascota} tuvo ${d.servicio} en ${d.negocio}. Tienes hasta el ${cuando(fechaPlazo, horaPlazo)} para calificar tu experiencia.`,
      };
    },
  },

  // Al propietario y a quien tiene resenas.responder. `d.calificacion`, `d.titulo`.
  resena_nueva: {
    correo: ["propietario"],
    contenido: (d) => {
      const estrellas = `${d.calificacion} ${d.calificacion === 1 ? "estrella" : "estrellas"}`;
      return {
        titulo: "Nueva reseña",
        push: `${d.negocio} recibió una reseña de ${estrellas}.`,
        mensaje: `${d.cliente} calificó con ${estrellas} ${d.servicio} del ${cuando(d.fecha, d.hora_inicio)}.${d.titulo ? ` "${d.titulo}"` : ""} Puedes responderla desde el panel.`,
        correo: {
          asunto: "Tu negocio recibió una reseña nueva en PetCat",
          parrafos: [`${d.negocio} recibió una reseña de ${estrellas}.`, "Puedes leerla y responderla en el panel de PetCat."],
        },
      };
    },
  },

  // Al dueño, solo con la primera respuesta del negocio.
  resena_respondida: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Respondieron tu reseña",
      push: `${d.negocio} respondió tu reseña.`,
      mensaje: `${d.negocio} respondió tu reseña de ${d.servicio}. Ábrela para leer la respuesta.`,
      correo: {
        asunto: `${d.negocio} respondió tu reseña`,
        parrafos: [`${d.negocio} respondió la reseña que dejaste en PetCat.`, "Puedes leer la respuesta en la app PetCat."],
      },
    }),
  },

  // Recordatorios de vacunas (job diario, hitos -7, 0 y +7 días respecto a fecha_proxima).
  // La push y el correo no llevan mascota ni vacuna; el detalle está en la app.
  vacuna_proxima: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Vacuna próxima",
      push: "Una vacuna de tu mascota vence en una semana. Abre PetCat para ver el carnet.",
      mensaje: `La vacuna ${d.vacuna} de ${d.mascota} vence el ${fechaLegible(d.fecha_proxima)}. Agenda la aplicación con tu veterinaria.`,
      correo: {
        asunto: "Una vacuna de tu mascota vence pronto",
        parrafos: correoVacuna(`Una vacuna de tu mascota vence el ${fechaLegible(d.fecha_proxima)}.`),
      },
    }),
  },

  vacuna_vence_hoy: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Vacuna para hoy",
      push: "Hoy vence una vacuna de tu mascota. Abre PetCat para ver el carnet.",
      mensaje: `Hoy vence la vacuna ${d.vacuna} de ${d.mascota}. Agenda la aplicación con tu veterinaria.`,
      correo: { asunto: "Hoy vence una vacuna de tu mascota", parrafos: correoVacuna("Hoy vence una vacuna de tu mascota.") },
    }),
  },

  vacuna_vencida: {
    correo: ["dueno"],
    contenido: (d) => ({
      titulo: "Vacuna vencida",
      push: "Una vacuna de tu mascota venció hace una semana. Abre PetCat para ver el carnet.",
      mensaje: `La vacuna ${d.vacuna} de ${d.mascota} venció el ${fechaLegible(d.fecha_proxima)}. Aplicarla pronto mantiene su protección.`,
      correo: {
        asunto: "Una vacuna de tu mascota está vencida",
        parrafos: correoVacuna(`Una vacuna de tu mascota venció el ${fechaLegible(d.fecha_proxima)}.`),
      },
    }),
  },

  // Avisos del plan (`soporte: true`): notificar() agrega en `d.soporte` el contacto de soporte
  // (soporte_email y soporte_whatsapp); la línea de contacto va en la app y el correo, no en la push.

  // Job de suscripciones. El panel es web y no recibe push: el propietario sin dispositivo recibe correo.
  plan_prueba_por_vencer: {
    correo: ["propietario"],
    soporte: true,
    contenido: (d) => {
      const cuandoTermina = d.dias === 0 ? "hoy" : d.dias === 1 ? "mañana" : `en ${d.dias} días`;
      const parrafos = conSoporte(
        [
          `La prueba gratuita del plan ${d.plan} de ${d.negocio} termina el ${fechaLegible(d.fecha_fin)}.`,
          "Después, el negocio pasa al plan Gratuito con sus límites de sucursales, empleados y citas al mes.",
          `Para seguir con el plan ${d.plan}, comunícate con PetCat.`,
        ],
        d.soporte
      );
      return {
        titulo: `Tu prueba del plan ${d.plan} termina ${cuandoTermina}`,
        push: `La prueba del plan ${d.plan} de ${d.negocio} termina ${cuandoTermina}.`,
        mensaje: parrafos.join(" "),
        correo: { asunto: `Tu prueba del plan ${d.plan} en PetCat termina ${cuandoTermina}`, parrafos },
      };
    },
  },

  plan_vencido: {
    correo: ["propietario"],
    soporte: true,
    contenido: (d) => {
      const que = d.prueba ? `Terminó la prueba gratuita del plan ${d.plan}` : `Venció el plan ${d.plan}`;
      const parrafos = conSoporte(
        [
          `${que} de ${d.negocio} y el negocio pasó al plan Gratuito.`,
          "Lo que ya tienes se conserva, pero no puedes agregar sucursales ni empleados por encima de sus límites y las reservas del mes tienen tope.",
          `Para volver al plan ${d.plan}, comunícate con PetCat.`,
        ],
        d.soporte
      );
      return {
        titulo: d.prueba ? `Terminó tu prueba del plan ${d.plan}` : `Venció tu plan ${d.plan}`,
        push: `${que} de ${d.negocio}. El negocio pasó al plan Gratuito.`,
        mensaje: parrafos.join(" "),
        correo: { asunto: d.prueba ? `Terminó tu prueba del plan ${d.plan} en PetCat` : `Venció tu plan ${d.plan} en PetCat`, parrafos },
      };
    },
  },

  plan_limite_alcanzado: {
    correo: [],
    soporte: true,
    contenido: (d) => ({
      titulo: "Límite de citas del plan",
      push: `Se rechazó una reserva: tu negocio alcanzó las ${d.maximo} citas de ${mesLegible(d.mes)} de su plan.`,
      mensaje: conSoporte(
        [
          `Tu negocio alcanzó las ${d.maximo} citas de ${mesLegible(d.mes)} del plan ${d.plan} y la app ya no muestra horarios de ese mes.`,
          "Para mejorar tu plan y seguir recibiendo reservas, comunícate con PetCat.",
        ],
        d.soporte
      ).join(" "),
    }),
  },

  plan_limite_80: {
    correo: [],
    soporte: true,
    contenido: (d) => ({
      titulo: "Te quedan pocas citas este mes",
      push: `Tu negocio lleva ${d.usadas} de ${d.maximo} citas de ${mesLegible(d.mes)} de su plan.`,
      mensaje: conSoporte(
        [
          `Tu negocio lleva ${d.usadas} de las ${d.maximo} citas de ${mesLegible(d.mes)} que permite el plan ${d.plan}.`,
          "Al llegar al límite, la app deja de mostrar horarios. Para mejorar tu plan, comunícate con PetCat.",
        ],
        d.soporte
      ).join(" "),
    }),
  },
};

export const TIPOS_NOTIFICACION = Object.keys(TIPOS);
