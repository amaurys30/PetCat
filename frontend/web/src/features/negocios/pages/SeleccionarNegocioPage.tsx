import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth";
import { Bienvenida } from "../components/Bienvenida";
import { rolEnNegocio, textoPlan } from "../textos";

/** A5 · Seleccionar negocio. Sin negocios: la bienvenida (crear uno o revisar la invitación). */
export function SeleccionarNegocioPage() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  if (!usuario) return null;
  const { negocios } = usuario;

  if (negocios.length === 0) return <Bienvenida />;

  return (
    <AuthCard>
      <AuthTitulo
        titulo={`Hola, ${usuario.nombre}`}
        descripcion={
          negocios.length === 1
            ? "Tienes acceso a 1 negocio."
            : `Tienes acceso a ${negocios.length} negocios. Elige con cuál quieres trabajar.`
        }
      />
      <ul className="flex flex-col gap-3">
        {negocios.map((n) => (
          <li key={n.id_negocio}>
            <Link
              to={`/n/${n.id_negocio}`}
              className="flex items-center gap-3 rounded-card border p-3.5 transition-colors hover:border-primary hover:bg-selected"
            >
              <Avatar nombre={n.nombre} fotoUrl={n.logo_miniatura_url} tamano="lg" />
              <span className="min-w-0 flex-1">
                <span className="block text-card font-semibold text-ink">{n.nombre}</span>
                <span className="block text-body text-muted">
                  {n.relacion === "propietario" ? "Propietario" : `Empleado · Rol: ${rolEnNegocio(n)}`}
                </span>
              </span>
              <Badge tono={n.plan.en_prueba ? "info" : n.plan.nombre === "Gratuito" ? "neutral" : "primary"}>
                {textoPlan(n.plan)}
              </Badge>
              <ArrowRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link to="/negocios/nuevo">
          <Plus /> Crear un negocio nuevo
        </Link>
      </Button>
      <div className="mt-4 text-center">
        <button type="button" onClick={() => void salir()} className="text-body text-muted hover:text-ink">
          Cerrar sesión
        </button>
      </div>
    </AuthCard>
  );
}
