import { Mail, MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/common/Logo";
import { enlaceWhatsapp } from "@/features/suscripcion/textos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { contenedor } from "../estilos";
import { useConfiguracionPublica, usePolitica } from "../hooks/usePublico";

const enlace = "rounded-control text-[15px] text-white/85 hover:text-white hover:underline";
const titulo = "text-[13px] font-semibold tracking-wide text-white/70 uppercase";

/**
 * Pie de las páginas públicas: política de datos y contacto de soporte de la API (lo que no
 * esté configurado no se muestra).
 */
export function PiePublico() {
  const usuario = useAuth((s) => s.usuario);
  const { data: politica } = usePolitica();
  const { data: configuracion } = useConfiguracionPublica();
  const soporte = configuracion?.soporte;
  const hayContacto = Boolean(soporte?.email || soporte?.whatsapp);

  return (
    <footer className="bg-ink text-white">
      <div className={cn(contenedor, "grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4")}>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Logo claro />
          <p className="max-w-sm text-[15px] leading-6 text-white/80">
            La plataforma que conecta a los dueños de mascotas con veterinarias y negocios de mascotas en
            Sincelejo.
          </p>
        </div>

        <nav aria-label="PetCat" className="flex flex-col gap-3">
          <h2 className={titulo}>PetCat</h2>
          <Link to="/" className={enlace}>
            Para dueños de mascotas
          </Link>
          <Link to="/para-negocios" className={enlace}>
            Para negocios
          </Link>
          <Link to={usuario ? "/panel" : "/login"} className={enlace}>
            {usuario ? "Ir al panel" : "Iniciar sesión"}
          </Link>
        </nav>

        <div className="flex flex-col gap-3">
          {hayContacto && (
            <>
              <h2 className={titulo}>Soporte</h2>
              {soporte?.email && (
                <a href={`mailto:${soporte.email}`} className={cn(enlace, "inline-flex items-center gap-2")}>
                  <Mail className="size-4" aria-hidden /> {soporte.email}
                </a>
              )}
              {soporte?.whatsapp && (
                <a
                  href={enlaceWhatsapp(soporte.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(enlace, "inline-flex items-center gap-2")}
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp {soporte.whatsapp}
                </a>
              )}
            </>
          )}
          {politica && (
            <>
              <h2 className={cn(titulo, hayContacto && "mt-4")}>Tus datos</h2>
              {politica.url ? (
                <a href={politica.url} target="_blank" rel="noreferrer" className={enlace}>
                  Política de tratamiento de datos
                </a>
              ) : (
                <p className="text-[15px] text-white/85">Política de tratamiento de datos</p>
              )}
              <p className="text-[13px] text-white/70">Versión {politica.version}</p>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className={cn(contenedor, "py-6 text-[14px] text-white/75")}>© PetCat · Sincelejo, Sucre</p>
      </div>
    </footer>
  );
}
