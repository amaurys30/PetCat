import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { EstadoCitaBadge } from "@/components/common/EstadoCitaBadge";
import {
  Cargando,
  CuentaBloqueada,
  LimitePlan,
  NoEncontrado,
  SesionExpirada,
  SinConexion,
  SinPermiso,
  Vacio,
} from "@/components/common/EstadoPantalla";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aviso } from "@/components/ui/toaster";
import { useUi } from "@/stores/ui";

/** S1 · Estados del sistema. Solo en desarrollo (/dev/estados), para revisarlos contra el Figma. */
export function EstadosDemoPage() {
  const abrirLimitePlan = useUi((s) => s.abrirLimitePlan);
  const tarjeta = (contenido: ReactNode) => (
    <Card className="flex items-center justify-center">{contenido}</Card>
  );

  return (
    <div className="mx-auto max-w-[1360px] p-10">
      <h1 className="text-[26px] font-bold text-ink">Estados del sistema</h1>
      <p className="mt-2 text-body text-muted">
        Pantallas y mensajes reutilizables para errores, vacíos y límites. Se muestran dentro del área de
        contenido del panel.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {tarjeta(<SinPermiso acciones={<Button variant="secondary">Volver al inicio</Button>} />)}
        {tarjeta(<NoEncontrado acciones={<Button variant="secondary">Volver</Button>} />)}
        {tarjeta(
          <Vacio
            titulo="Aún no hay citas esta semana"
            descripcion="Cuando tus clientes reserven desde la app o agendes desde aquí, aparecerán en este lugar."
            acciones={
              <Button>
                <Plus /> Nueva cita
              </Button>
            }
          />,
        )}
        {tarjeta(<Cargando className="w-full" />)}
        {tarjeta(<SinConexion acciones={<Button variant="secondary">Reintentar</Button>} />)}
        {tarjeta(<SesionExpirada acciones={<Button>Iniciar sesión</Button>} />)}
        {tarjeta(
          <LimitePlan
            descripcion="30 de 30 citas este mes en el plan Gratuito. Las reservas de la app se rechazarán hasta el próximo mes."
            acciones={
              <Button
                onClick={() =>
                  abrirLimitePlan(
                    "Tu plan Gratuito permite hasta 30 citas al mes. Mejora tu plan para continuar.",
                  )
                }
              >
                Abrir el diálogo
              </Button>
            }
          />,
        )}
        {tarjeta(<CuentaBloqueada acciones={<Button variant="secondary">Restablecer contraseña</Button>} />)}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-card font-semibold text-ink">Avisos flotantes (toasts)</h2>
          <Button variant="secondary" onClick={() => aviso.exito("Cita confirmada. Avisamos a Sofía.")}>
            Éxito
          </Button>
          <Button variant="secondary" onClick={() => aviso.error("No se pudo guardar. Intenta de nuevo.")}>
            Error
          </Button>
          <Button
            variant="secondary"
            onClick={() => aviso.advertencia("El horario ya no está disponible (409).")}
          >
            Advertencia
          </Button>
        </Card>
      </div>

      <h2 className="mt-10 text-title font-bold text-ink">Estados de cita</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            "pendiente",
            "confirmada",
            "en_curso",
            "completada",
            "cancelada",
            "no_asistio",
            "reprogramada",
          ] as const
        ).map((estado) => (
          <EstadoCitaBadge key={estado} estado={estado} />
        ))}
        <EstadoCitaBadge estado="cancelada" cancelacion={{ por: "sistema", tardia: false }} />
        <EstadoCitaBadge estado="cancelada" cancelacion={{ por: "dueno", tardia: true }} />
        <EstadoCitaBadge estado="confirmada" fueraDeDisponibilidad />
      </div>

      <h2 className="mt-10 text-title font-bold text-ink">Botones</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button>Guardar</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="link">Ver todas →</Button>
        <Button variant="danger-outline">Cancelar cita</Button>
        <Button variant="danger">Eliminar</Button>
        <Button cargando>Guardando</Button>
      </div>
    </div>
  );
}
