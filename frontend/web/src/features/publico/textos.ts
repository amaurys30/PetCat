import { TIPOS_NEGOCIO } from "@/features/negocios/textos";

/** Centro de Sincelejo: el origen de la búsqueda sin la ubicación del navegador. */
export const SINCELEJO = { lat: 9.30472, lng: -75.39778 };

/** Tipo del negocio como se muestra; si la API trae uno nuevo, tal cual. */
export const textoTipo = (tipo: string) => TIPOS_NEGOCIO[tipo as keyof typeof TIPOS_NEGOCIO] ?? tipo;

/** Filtros del buscador (los tipos de la API, en plural). */
export const FILTROS_TIPO: { valor: string | undefined; texto: string }[] = [
  { valor: undefined, texto: "Todos" },
  { valor: "veterinaria", texto: "Veterinarias" },
  { valor: "clinica", texto: "Clínicas" },
  { valor: "peluqueria_canina", texto: "Peluquerías" },
  { valor: "guarderia", texto: "Guarderías" },
  { valor: "tienda_mascotas", texto: "Tiendas" },
  { valor: "entrenador", texto: "Entrenadores" },
  { valor: "multiservicio", texto: "Multiservicio" },
];

const ES = "es-CO";

/** 0,35 -> "a 350 m"; 1,78 -> "a 1,8 km". */
export function textoDistancia(km: number): string {
  if (km < 1) return `a ${Math.max(Math.round((km * 1000) / 50) * 50, 50)} m`;
  return `a ${km.toLocaleString(ES, { maximumFractionDigits: 1 })} km`;
}

/** 4.666 -> "4,7". */
export const textoCalificacion = (valor: number) =>
  valor.toLocaleString(ES, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const textoNumero = (valor: number) => valor.toLocaleString(ES);

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-09" -> "septiembre de 2026". */
export function textoMes(anioMes: string): string {
  const [anio, mes] = anioMes.split("-").map(Number);
  const nombre = MESES[(mes ?? 0) - 1];
  return nombre && anio ? `${nombre} de ${anio}` : anioMes;
}

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

/** Preguntas de los dueños, con lo que hace la plataforma hoy. */
export const PREGUNTAS_DUENOS: Pregunta[] = [
  {
    pregunta: "¿Cuánto me cuesta usar PetCat?",
    respuesta:
      "Nada. Para los dueños de mascotas PetCat es gratis: crear tu cuenta, registrar tus mascotas, llevar su carnet de vacunas e historial y agendar citas. Solo pagas al negocio por los servicios que tome tu mascota.",
  },
  {
    pregunta: "¿Quién puede ver el historial médico de mi mascota?",
    respuesta:
      "Tú ves todo el historial de tus mascotas. Un negocio solo puede ver la ficha de una mascota si tiene al menos una cita con ella. Si desactivas \"compartir historial\", cada negocio ve solo lo que él mismo registró; las vacunas, alergias y condiciones médicas siguen visibles para los negocios con cita, para cuidar su salud y evitar vacunas repetidas.",
  },
  {
    pregunta: "¿Qué negocios encuentro en PetCat?",
    respuesta:
      "Veterinarias, clínicas, peluquerías caninas, guarderías, tiendas de mascotas y entrenadores. Empezamos en Sincelejo (Sucre); en el buscador de esta página ves los que ya están activos.",
  },
  {
    pregunta: "¿Cuándo sale la app?",
    respuesta:
      "Estamos terminando la app para Android y iPhone, y la publicaremos en Google Play y App Store muy pronto. Mientras tanto, tu veterinaria puede registrarte desde su panel: te llega un correo para activar tu cuenta y tu mascota queda con su historial listo.",
  },
  {
    pregunta: "¿Puedo tener varias mascotas en mi cuenta?",
    respuesta:
      "Sí. Cada mascota tiene su propio carnet de vacunas, historial médico y citas, y todas son tuyas: si cambias de veterinaria, su historial sigue contigo.",
  },
];

/** Preguntas de los negocios. Las del plan y la prueba se arman con los datos de la API. */
export const preguntasNegocios = (diasPrueba: number | null): Pregunta[] => [
  {
    pregunta: "¿Cuánto cuesta PetCat para mi negocio?",
    respuesta:
      "Puedes empezar gratis, sin tiempo límite, con el plan Gratuito. Cuando lo necesites, pasas a Pro o Enterprise; los precios y límites de cada plan están en esta página.",
  },
  {
    pregunta: "¿Cómo funciona la prueba del plan Pro?",
    respuesta: `Desde el panel, el propietario activa la prueba del plan Pro una vez por negocio${
      diasPrueba ? `, durante ${diasPrueba} días` : ""
    }, sin tarjeta. Al terminar, el negocio vuelve al plan Gratuito: no se borra nada, solo vuelven a aplicar sus límites.`,
  },
  {
    pregunta: "¿Mis clientes necesitan la app para agendar?",
    respuesta:
      "No. Desde el panel registras a tus clientes y sus mascotas, aunque no usen la app, y les agendas citas. Si les agregas un correo, reciben un enlace para activar su cuenta y ver el historial de sus mascotas.",
  },
  {
    pregunta: "¿Quién de mi equipo ve qué?",
    respuesta:
      "Cada miembro tiene un rol con permisos por módulo: agenda, clientes, historial médico, vacunas, servicios, reseñas, configuración y más. Hay roles listos (administrador, veterinario, recepcionista) y puedes crear los tuyos.",
  },
  {
    pregunta: "¿De quién es la historia clínica?",
    respuesta:
      "La mascota pertenece a su dueño. Tu negocio ve el historial de las mascotas que tienen al menos una cita contigo y registra consultas, tratamientos y vacunas que el dueño ve en su celular.",
  },
  {
    pregunta: "¿Cómo aparece mi negocio en \"Cerca de mí\"?",
    respuesta:
      "Al crear tu negocio ubicas tu sede en el mapa. Con eso, los dueños que buscan cerca de su ubicación encuentran tu negocio, con su calificación y sus reseñas verificadas.",
  },
];
