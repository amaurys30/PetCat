import {
  BarChart3,
  BellRing,
  CalendarCheck,
  MapPin,
  Star,
  Stethoscope,
  Store,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { Aparecer } from "../components/Aparecer";
import { EncabezadoPublico, type EnlaceSeccion } from "../components/EncabezadoPublico";
import { IlustracionNegocios } from "../components/Ilustraciones";
import { PiePublico } from "../components/PiePublico";
import { PreguntasFrecuentes, Seccion, TarjetasBeneficios, type Beneficio } from "../components/Secciones";
import { TarjetaPlan } from "../components/TarjetaPlan";
import {
  botonBorde,
  botonClaro,
  botonPrimario,
  botonSecundario,
  contenedor,
  etiquetaSeccion,
  textoSeccion,
} from "../estilos";
import { useMetadatos } from "../hooks/useMetadatos";
import { useConfiguracionPublica, usePlanes } from "../hooks/usePublico";
import { preguntasNegocios } from "../textos";
import { SaltarAlContenido } from "@/components/common/SaltarAlContenido";

const TITULO = "PetCat para negocios · Agenda en línea para veterinarias y negocios de mascotas";
const DESCRIPCION =
  "Agenda en línea con confirmación automática, recordatorios que reducen inasistencias, historias clínicas, carnet de vacunas, equipo con roles y reseñas verificadas. Empieza gratis.";

const SECCIONES: EnlaceSeccion[] = [
  { href: "#beneficios", texto: "Beneficios" },
  { href: "#planes", texto: "Planes" },
  { href: "#preguntas", texto: "Preguntas" },
];

const BENEFICIOS: Beneficio[] = [
  {
    icono: CalendarCheck,
    titulo: "Agenda con confirmación automática",
    texto:
      "Tus clientes reservan en las horas libres de cada profesional. Confirma a mano o deja que se confirmen solas.",
    tono: "teal",
  },
  {
    icono: BellRing,
    titulo: "Menos inasistencias",
    texto:
      "Recordatorios automáticos antes de cada cita y de las próximas vacunas, sin que tengas que llamar.",
    tono: "naranja",
  },
  {
    icono: Stethoscope,
    titulo: "Fichas médicas y carnet de vacunas",
    texto: "Consultas, tratamientos, controles, archivos y vacunas de cada mascota, vinculados a sus citas.",
    tono: "azul",
  },
  {
    icono: UsersRound,
    titulo: "Equipo con roles y permisos",
    texto: "Invita a tu equipo y decide qué ve y qué hace cada uno: agenda, clientes, historial y más.",
    tono: "lila",
  },
  {
    icono: Star,
    titulo: "Reseñas verificadas",
    texto: "Solo reseñan los clientes que fueron a su cita. Responde desde el panel y cuida tu reputación.",
    tono: "naranja",
  },
  {
    icono: BarChart3,
    titulo: "Dashboard de tu negocio",
    texto: "Citas, ingresos registrados, servicios más pedidos y lo que necesita tu atención, de un vistazo.",
    tono: "teal",
  },
  {
    icono: MapPin,
    titulo: 'Aparece en "Cerca de mí"',
    texto: "Los dueños que buscan cerca encuentran tu negocio con su calificación y sus servicios.",
    tono: "azul",
  },
];

/** Página para veterinarias, peluquerías, guarderías y demás negocios (/para-negocios). */
export function ParaNegociosPage() {
  useMetadatos({ titulo: TITULO, descripcion: DESCRIPCION });
  const usuario = useAuth((s) => s.usuario);
  const planes = usePlanes();
  const configuracion = useConfiguracionPublica();
  const diasPrueba = configuracion.data?.prueba_pro_dias ?? null;
  const soporte = configuracion.data?.soporte;
  const acceso = usuario ? { to: "/panel", texto: "Ir al panel" } : { to: "/login", texto: "Iniciar sesión" };

  const accionPlan = (nombre: string) => {
    if (nombre === "Enterprise" && soporte?.email) {
      return {
        to: `mailto:${soporte.email}?subject=${encodeURIComponent("Plan Enterprise de PetCat")}`,
        texto: "Hablar con PetCat",
        externo: true,
      };
    }
    if (nombre === "Pro" && diasPrueba)
      return { to: "/registro", texto: `Probar Pro ${diasPrueba} días gratis` };
    return { to: "/registro", texto: "Crear mi negocio gratis" };
  };

  return (
    <div className="pagina-publica flex min-h-screen flex-col bg-white text-ink">
      <SaltarAlContenido />
      <EncabezadoPublico secciones={SECCIONES} otraPagina={{ to: "/", texto: "¿Tienes una mascota?" }} />

      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-soft via-selected to-white">
          <div
            className={cn(
              contenedor,
              "grid items-center gap-10 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-20 lg:pb-24",
            )}
          >
            <Aparecer className="flex flex-col items-start gap-6">
              <p className={cn(etiquetaSeccion, "bg-white")}>
                <Store className="size-4" aria-hidden /> PetCat para negocios
              </p>
              <h1 className="text-[34px] leading-[40px] font-extrabold tracking-tight text-ink sm:text-[46px] sm:leading-[54px] lg:text-[52px] lg:leading-[60px]">
                Agenda en línea, menos inasistencias, <span className="text-primary-deep">más clientes</span>
              </h1>
              <p className={cn(textoSeccion, "max-w-xl text-ink/80")}>
                El panel de PetCat organiza las citas, los recordatorios, las historias clínicas y las reseñas
                de tu veterinaria, peluquería, guardería o tienda. Empieza gratis y crece cuando lo necesites.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link to="/registro" className={botonPrimario}>
                  Crear mi negocio gratis
                </Link>
                <Link to={acceso.to} className={botonSecundario}>
                  {acceso.texto}
                </Link>
              </div>
            </Aparecer>
            <Aparecer>
              <IlustracionNegocios className="mx-auto w-full max-w-[560px]" />
            </Aparecer>
          </div>
        </section>

        <Seccion
          id="beneficios"
          etiqueta="Todo en un panel"
          titulo="Lo que tu negocio gana con PetCat"
          descripcion="Funciones que ya están en el panel, pensadas para el día a día de un negocio de mascotas."
        >
          <TarjetasBeneficios beneficios={BENEFICIOS} />
        </Seccion>

        <Seccion
          id="planes"
          etiqueta="Planes"
          titulo="Empieza gratis, crece con Pro"
          descripcion={
            <>
              Precios en pesos colombianos (COP).
              {diasPrueba && ` El plan Pro tiene una prueba gratis de ${diasPrueba} días, sin tarjeta.`}
            </>
          }
          className="bg-surface"
        >
          {planes.isPending ? (
            <ul className="grid gap-6 lg:grid-cols-3" aria-label="Cargando planes" aria-busy>
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="flex flex-col gap-4 rounded-modal border border-border bg-white p-7">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </li>
              ))}
            </ul>
          ) : planes.isError ? (
            <div className="rounded-modal border border-border bg-white p-8 text-center">
              <p className="text-[16px] font-semibold text-ink">No pudimos cargar los planes.</p>
              <button
                type="button"
                className={cn(botonSecundario, "mt-4")}
                onClick={() => void planes.refetch()}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <ul className="grid gap-6 pt-3 lg:grid-cols-3">
              {planes.data.map((plan, i) => (
                <TarjetaPlan
                  key={plan.id_plan}
                  plan={plan}
                  anterior={planes.data[i - 1]}
                  destacado={plan.nombre === "Pro"}
                  diasPrueba={diasPrueba}
                  accion={accionPlan(plan.nombre)}
                />
              ))}
            </ul>
          )}
          <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-6 text-muted">
            Mientras habilitamos los pagos en línea, los planes pagos se contratan con el equipo de PetCat
            {soporte?.email ? (
              <>
                {" "}
                escribiendo a{" "}
                <a href={`mailto:${soporte.email}`} className="font-semibold text-primary-deep underline">
                  {soporte.email}
                </a>
              </>
            ) : null}
            . La prueba Pro se activa desde el panel, una vez por negocio.
          </p>
        </Seccion>

        <section aria-labelledby="cta-negocios" className="py-16 sm:py-20">
          <Aparecer className={contenedor}>
            <div className="flex flex-col items-center gap-5 rounded-modal bg-marca-oscura px-6 py-12 text-center text-white sm:px-10 lg:py-16">
              <h2
                id="cta-negocios"
                className="max-w-2xl text-[26px] leading-8 font-bold sm:text-[34px] sm:leading-[42px]"
              >
                Lleva tu negocio de mascotas al siguiente nivel
              </h2>
              <p className="max-w-xl text-[16px] leading-[26px] text-white">
                Crea tu cuenta, registra tu negocio y tu primera sede, y empieza a recibir citas hoy.
              </p>
              <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <Link to="/registro" className={botonClaro}>
                  Crear mi negocio gratis
                </Link>
                <Link to={acceso.to} className={botonBorde}>
                  {acceso.texto}
                </Link>
              </div>
            </div>
          </Aparecer>
        </section>

        <Seccion
          id="preguntas"
          etiqueta="Preguntas frecuentes"
          titulo="Preguntas de los negocios"
          className="bg-surface"
        >
          <PreguntasFrecuentes preguntas={preguntasNegocios(diasPrueba)} />
          {(soporte?.email || soporte?.whatsapp) && (
            <p className="mt-8 text-center text-[15px] text-muted">
              ¿Otra pregunta? Escríbenos
              {soporte.email && (
                <>
                  {" "}
                  a{" "}
                  <a href={`mailto:${soporte.email}`} className="font-semibold text-primary-deep underline">
                    {soporte.email}
                  </a>
                </>
              )}
              {soporte.whatsapp && (
                <>
                  {soporte.email ? " o por WhatsApp al " : " por WhatsApp al "}
                  <span className="font-semibold text-ink">{soporte.whatsapp}</span>
                </>
              )}
              .
            </p>
          )}
        </Seccion>
      </main>

      <PiePublico />
    </div>
  );
}
