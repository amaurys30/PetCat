import {
  BellRing,
  CalendarCheck,
  ClipboardList,
  MapPin,
  Search,
  ShieldCheck,
  Syringe,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Aparecer } from "../components/Aparecer";
import { BuscadorNegocios } from "../components/BuscadorNegocios";
import { Cifras, ResenasDestacadas } from "../components/DatosReales";
import { EncabezadoPublico, type EnlaceSeccion } from "../components/EncabezadoPublico";
import { IlustracionBanda, IlustracionDuenos } from "../components/Ilustraciones";
import { PiePublico } from "../components/PiePublico";
import {
  BotonesTiendas,
  Pasos,
  PreguntasFrecuentes,
  Seccion,
  TarjetasBeneficios,
  type Beneficio,
} from "../components/Secciones";
import { botonClaro, botonPrimario, contenedor, etiquetaSeccion, textoSeccion } from "../estilos";
import { useMetadatos } from "../hooks/useMetadatos";
import { PREGUNTAS_DUENOS } from "../textos";
import { SaltarAlContenido } from "@/components/common/SaltarAlContenido";

const TITULO_LANDING = "PetCat · Todo lo de tu mascota en un solo lugar";
const DESCRIPCION =
  "Citas, carnet de vacunas, recordatorios e historial médico de tu mascota en tu celular. Encuentra veterinarias cerca en Sincelejo y agenda sin llamadas. Gratis para dueños de mascotas.";

const SECCIONES: EnlaceSeccion[] = [
  { href: "#beneficios", texto: "Beneficios" },
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#buscar", texto: "Veterinarias cerca" },
  { href: "#preguntas", texto: "Preguntas" },
];

const BENEFICIOS: Beneficio[] = [
  {
    icono: CalendarCheck,
    titulo: "Agenda sin llamadas",
    texto: "Elige el servicio, el profesional y una hora libre. Sin esperar a que te contesten.",
    tono: "teal",
  },
  {
    icono: Syringe,
    titulo: "Carnet de vacunas digital",
    texto: "Las vacunas de tu mascota siempre a mano, con la próxima dosis y el comprobante.",
    tono: "naranja",
  },
  {
    icono: BellRing,
    titulo: "Recordatorios a tiempo",
    texto: "Te avisamos antes de cada cita y cuando se acerca una vacuna. Nada se te pasa.",
    tono: "lila",
  },
  {
    icono: ClipboardList,
    titulo: "Historial médico en tu celular",
    texto: "Consultas, tratamientos, controles y peso de cada mascota, de todas sus veterinarias.",
    tono: "azul",
  },
  {
    icono: MapPin,
    titulo: "Veterinarias cerca de ti",
    texto: "Encuentra negocios cercanos con reseñas verificadas: solo opina quien fue a su cita.",
    tono: "teal",
  },
  {
    icono: ShieldCheck,
    titulo: "Tú decides quién ve su historial",
    texto: "Solo los negocios con una cita de tu mascota ven su ficha, y puedes limitar qué ven.",
    tono: "naranja",
  },
];

const PASOS = [
  {
    titulo: "Crea tu cuenta y registra a tu mascota",
    texto: "Es gratis. Agrega a cada mascota con su especie, raza, edad y vacunas.",
  },
  {
    titulo: "Busca un negocio y agenda",
    texto: "Encuentra veterinarias, peluquerías o guarderías cerca y reserva la hora que te sirve.",
  },
  {
    titulo: "Recibe recordatorios y lleva su historial",
    texto: "Después de la cita, el negocio registra la atención y las vacunas, y tú las ves en tu celular.",
  },
];

/** Landing para dueños de mascotas (/). Con sesión, el encabezado dice "Ir al panel". */
export function LandingPage() {
  useMetadatos({ titulo: TITULO_LANDING, descripcion: DESCRIPCION });

  return (
    <div className="pagina-publica flex min-h-screen flex-col bg-white text-ink">
      <SaltarAlContenido />
      <EncabezadoPublico
        secciones={SECCIONES}
        otraPagina={{ to: "/para-negocios", texto: "¿Tienes una veterinaria?" }}
      />

      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-soft via-selected to-white">
          <div
            className={cn(
              contenedor,
              "grid items-center gap-10 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-20 lg:pb-24",
            )}
          >
            <Aparecer className="flex flex-col items-start gap-6">
              <p className={cn(etiquetaSeccion, "bg-white")}>
                <Sparkles className="size-4" aria-hidden /> Gratis para dueños de mascotas
              </p>
              <h1 className="text-[36px] leading-[42px] font-extrabold tracking-tight text-ink sm:text-[48px] sm:leading-[56px] lg:text-[56px] lg:leading-[64px]">
                Todo lo de tu mascota, <span className="text-primary-deep">en un solo lugar</span>
              </h1>
              <p className={cn(textoSeccion, "max-w-xl text-ink/80")}>
                Citas, carnet de vacunas, recordatorios e historial médico, siempre en tu celular. Encuentra
                veterinarias cerca y agenda sin llamadas.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <a href="#buscar" className={botonPrimario}>
                  <Search aria-hidden /> Buscar veterinarias cerca
                </a>
              </div>
              <div id="app" className="flex flex-col gap-3">
                <p className="text-[15px] font-semibold text-ink">Descargar la app</p>
                <BotonesTiendas />
              </div>
            </Aparecer>
            <Aparecer>
              <IlustracionDuenos className="mx-auto w-full max-w-[560px]" />
            </Aparecer>
          </div>
        </section>

        <Seccion
          id="beneficios"
          etiqueta="Para ti y tu mascota"
          titulo="Cuidar a tu mascota, más fácil"
          descripcion="PetCat reúne lo que hoy tienes en papeles, chats y llamadas: sus citas, sus vacunas y su historia."
        >
          <TarjetasBeneficios beneficios={BENEFICIOS} />
        </Seccion>

        <Seccion id="como-funciona" etiqueta="Cómo funciona" titulo="En tres pasos" className="bg-surface">
          <Pasos pasos={PASOS} />
        </Seccion>

        <Seccion
          id="buscar"
          etiqueta="Cerca de ti"
          titulo="Veterinarias y negocios cerca"
          descripcion="Con tu ubicación te mostramos los más cercanos; si prefieres no compartirla, buscamos en Sincelejo."
        >
          <BuscadorNegocios />
        </Seccion>

        <Cifras />
        <ResenasDestacadas />

        {/* Banda para negocios */}
        <section aria-labelledby="banda-negocios" className="py-16 sm:py-20">
          <Aparecer className={contenedor}>
            <div className="grid items-center gap-8 overflow-hidden rounded-modal bg-marca-oscura px-6 py-10 text-white sm:px-10 md:grid-cols-[1fr_auto] lg:px-14 lg:py-14">
              <div className="flex flex-col items-start gap-4">
                <h2
                  id="banda-negocios"
                  className="text-[26px] leading-8 font-bold sm:text-[32px] sm:leading-10"
                >
                  ¿Tienes una veterinaria o un negocio de mascotas?
                </h2>
                <p className="max-w-2xl text-[16px] leading-[26px] text-white">
                  Recibe citas en línea, envía recordatorios automáticos, lleva las historias clínicas y el
                  carnet de vacunas, y aparece cuando los dueños buscan cerca. Empieza gratis.
                </p>
                <Link to="/para-negocios" className={cn(botonClaro, "mt-2")}>
                  Conoce PetCat para negocios
                </Link>
              </div>
              <IlustracionBanda className="mx-auto hidden w-[200px] md:block" />
            </div>
          </Aparecer>
        </section>

        <Seccion
          id="preguntas"
          etiqueta="Preguntas frecuentes"
          titulo="¿Tienes dudas?"
          className="bg-surface"
        >
          <PreguntasFrecuentes preguntas={PREGUNTAS_DUENOS} />
        </Seccion>
      </main>

      <PiePublico />
    </div>
  );
}
