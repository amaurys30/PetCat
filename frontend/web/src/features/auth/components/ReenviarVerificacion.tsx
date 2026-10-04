import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCuentaRegresiva } from "@/lib/useCuentaRegresiva";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useReenviarVerificacion } from "../hooks/useAuthMutations";

const ESPERA_SEGUNDOS = 60;

/**
 * Aviso "confirma tu correo" con el botón para reenviar el enlace (con sesión).
 * La API permite un correo por minuto: después de enviar, o con un 429, espera 60 s.
 * Si el correo ya estaba verificado (409), recarga el perfil y el aviso desaparece.
 */
export function ReenviarVerificacion({ className }: { className?: string }) {
  const usuario = useAuth((s) => s.usuario);
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  const reenviar = useReenviarVerificacion();
  const [espera, iniciarEspera] = useCuentaRegresiva();

  if (!usuario || usuario.email_verificado) return null;

  const onReenviar = () =>
    reenviar.mutate(undefined, {
      onSuccess: () => iniciarEspera(ESPERA_SEGUNDOS),
      onError: (error) => {
        if (error.status === 429) iniciarEspera(ESPERA_SEGUNDOS);
        if (error.status === 409) void recargarUsuario();
      },
    });

  return (
    <div className={cn("rounded-control bg-surface p-3.5 text-left", className)}>
      <p className="flex gap-2 text-body text-ink">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Confirma tu correo: te enviamos un enlace a{" "}
          <strong className="font-semibold">{usuario.email}</strong>. Vence en 24 horas.
        </span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 pl-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={onReenviar}
          cargando={reenviar.isPending}
          disabled={espera > 0}
        >
          {espera > 0 ? `Reenviar en ${espera} s` : "Reenviar enlace"}
        </Button>
        <span role="status" className="text-label text-muted">
          {reenviar.isSuccess && "Te enviamos un enlace nuevo. Revisa también la carpeta de spam."}
          {reenviar.isError && reenviar.error.message}
        </span>
      </div>
    </div>
  );
}
