import { useMutation } from "@tanstack/react-query";
import { ArrowRight, PawPrint, Users } from "lucide-react";
import { Link } from "react-router";
import { AuthCard, AuthTitulo } from "@/app/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { ReenviarVerificacion } from "@/features/auth/components/ReenviarVerificacion";
import { useAuth } from "@/stores/auth";

/**
 * A5 sin negocios: la bienvenida después de crear la cuenta. Recuerda confirmar el
 * correo (no bloquea nada) y ofrece crear el negocio o esperar una invitación.
 * Al aceptar la invitación, el negocio llega en /auth/me y A5 muestra la lista.
 */
export function Bienvenida() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  const actualizar = useMutation({ meta: { avisarError: false }, mutationFn: recargarUsuario });

  if (!usuario) return null;
  const sigueSinNegocios = actualizar.isSuccess && actualizar.data.negocios.length === 0;

  return (
    <AuthCard className="w-[460px]">
      <AuthTitulo
        titulo={`Hola, ${usuario.nombre}`}
        descripcion="Tu cuenta todavía no tiene un negocio en PetCat. ¿Cómo quieres empezar?"
      />

      <ReenviarVerificacion className="mb-4" />

      <div className="flex flex-col gap-3">
        <section className="rounded-card border p-4">
          <h2 className="flex items-center gap-2 text-card font-semibold text-ink">
            <PawPrint className="size-4 text-primary" aria-hidden /> Tengo un negocio
          </h2>
          <p className="mt-1 text-body text-muted">
            Registra tu veterinaria, tienda o peluquería y empieza a recibir reservas desde la app.
          </p>
          <Button asChild className="mt-3 w-full">
            <Link to="/negocios/nuevo">
              Crear mi negocio <ArrowRight />
            </Link>
          </Button>
        </section>

        <section className="rounded-card border p-4">
          <h2 className="flex items-center gap-2 text-card font-semibold text-ink">
            <Users className="size-4 text-primary" aria-hidden /> Me invitaron a un equipo
          </h2>
          <p className="mt-1 text-body text-muted">
            Revisa tu correo y abre el enlace de la invitación: al aceptarla, el negocio aparecerá aquí.
          </p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            cargando={actualizar.isPending}
            onClick={() => actualizar.mutate()}
          >
            Ya la acepté, actualizar
          </Button>
          <p role="status" className="mt-2 text-label text-muted empty:hidden">
            {sigueSinNegocios &&
              "Todavía no tienes acceso a ningún negocio. Si la invitación venció, pide al negocio que te la reenvíe."}
            {actualizar.isError && actualizar.error.message}
          </p>
        </section>
      </div>

      <div className="mt-4 text-center">
        <button type="button" onClick={() => void salir()} className="text-body text-muted hover:text-ink">
          Cerrar sesión
        </button>
      </div>
    </AuthCard>
  );
}
