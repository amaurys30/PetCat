import { Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Plan } from "@/api/negocios";
import type { Suscripcion } from "@/api/types";
import { SinPermiso } from "@/components/common/EstadoPantalla";
import { QueryState } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanes } from "@/features/negocios/hooks/useGestion";
import { useNegocioActivo, usePuede, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { dinero } from "@/lib/format";
import { puedeActivarPrueba } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { BarraUso } from "../components/BarraUso";
import { ConfirmarPruebaPro } from "../components/PruebaPro";
import {
  avisoVencida,
  diasRestantes,
  enlaceContratar,
  enlaceWhatsapp,
  lineaVencimiento,
  ventajasPlan,
} from "../textos";

/** E4 · Suscripción: plan actual con el uso de cada límite, la prueba Pro, los planes y cómo contratar. */
export function SuscripcionPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const verSuscripcion = puede("configuracion", "ver");
  const suscripcion = useSuscripcion(negocio.id_negocio, verSuscripcion);
  const [confirmar, setConfirmar] = useState(false);

  if (!verSuscripcion) {
    return (
      <Card>
        <SinPermiso
          acciones={
            <Button asChild variant="secondary">
              <Link to="..">Volver al inicio</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <QueryState
      query={suscripcion}
      cargando={<Skeleton etiqueta="Cargando suscripción" className="h-48 rounded-card" />}
    >
      {(datos) => (
        <div className="flex flex-col gap-5">
          <PlanActual suscripcion={datos} onProbar={() => setConfirmar(true)} />
          <Planes suscripcion={datos} onProbar={() => setConfirmar(true)} />
          <Contacto soporte={datos.soporte} />
          <ConfirmarPruebaPro
            idNegocio={negocio.id_negocio}
            abierto={confirmar}
            onAbiertoChange={setConfirmar}
          />
        </div>
      )}
    </QueryState>
  );
}

/** ¿Quien mira puede activar la prueba ahora? */
function usePuedeProbar(suscripcion: Suscripcion) {
  const usuario = useAuth((s) => s.usuario);
  const negocio = useNegocioActivo();
  return { disponible: suscripcion.prueba_disponible, propietario: puedeActivarPrueba(usuario, negocio) };
}

function EstadoPlan({ suscripcion }: { suscripcion: Suscripcion }) {
  const actual = suscripcion.suscripcion;
  if (actual?.estado === "en_prueba") {
    const dias = actual.dias_prueba_restantes;
    return <Badge tono="info">En prueba{dias != null ? ` · ${diasRestantes(dias)}` : ""}</Badge>;
  }
  if (actual?.estado === "vencida") return <Badge tono="danger">{actual.plan.nombre} vencido</Badge>;
  return <Badge tono="primary">Activo</Badge>;
}

function PlanActual({ suscripcion, onProbar }: { suscripcion: Suscripcion; onProbar: () => void }) {
  const { disponible, propietario } = usePuedeProbar(suscripcion);
  const vencida = avisoVencida(suscripcion);
  const { uso } = suscripcion;
  return (
    <Card className="grid grid-cols-[300px_1fr] gap-8 p-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-card font-semibold text-ink">Plan actual</h2>
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[28px] leading-tight font-bold text-ink">{suscripcion.plan.nombre}</span>
            <EstadoPlan suscripcion={suscripcion} />
          </p>
          <p className="mt-1 text-body text-muted">{lineaVencimiento(suscripcion)}</p>
        </div>
        {vencida && <Alert tono="advertencia">{vencida}</Alert>}
        {disponible && (
          <>
            <p className="rounded-control bg-primary-soft px-3 py-2.5 text-body text-primary-dark">
              Tienes disponible una prueba Pro de 14 días, una sola vez.
            </p>
            {propietario ? (
              <Button className="self-start" onClick={onProbar}>
                Probar Pro 14 días
              </Button>
            ) : (
              <p className="text-label text-muted">Solo el propietario del negocio puede activarla.</p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col justify-center gap-4">
        <BarraUso etiqueta="Citas este mes" uso={uso.citas_mes} />
        <BarraUso etiqueta="Sedes" uso={uso.sucursales} avisar={false} />
        <BarraUso etiqueta="Empleados (sin contar al propietario)" uso={uso.empleados} avisar={false} />
        <BarraUso etiqueta="Productos (inventario, Fase 3)" uso={uso.productos} avisar={false} />
      </div>
    </Card>
  );
}

function Planes({ suscripcion, onProbar }: { suscripcion: Suscripcion; onProbar: () => void }) {
  const planes = usePlanes();
  if (planes.isPending) return <Skeleton etiqueta="Cargando planes" className="h-64 rounded-card" />;
  if (planes.isError) return null;
  const lista = planes.data;
  // Se recomienda el primer plan con estadísticas avanzadas, si el actual no las tiene.
  const recomendado = suscripcion.plan.caracteristicas.estadisticas_avanzadas
    ? null
    : lista.find((p) => p.caracteristicas.estadisticas_avanzadas)?.id_plan;
  return (
    <section aria-label="Planes" className="grid grid-cols-3 gap-5">
      {lista.map((plan, i) => (
        <TarjetaPlan
          key={plan.id_plan}
          plan={plan}
          anterior={lista[i - 1]}
          suscripcion={suscripcion}
          recomendado={plan.id_plan === recomendado}
          onProbar={onProbar}
        />
      ))}
    </section>
  );
}

function TarjetaPlan({
  plan,
  anterior,
  suscripcion,
  recomendado,
  onProbar,
}: {
  plan: Plan;
  anterior: Plan | undefined;
  suscripcion: Suscripcion;
  recomendado: boolean;
  onProbar: () => void;
}) {
  const negocio = useNegocioActivo();
  const { disponible, propietario } = usePuedeProbar(suscripcion);
  const actual = plan.id_plan === suscripcion.plan.id_plan;
  const titulo = `plan-${plan.id_plan}`;

  let accion;
  if (actual) {
    accion = (
      <Button variant="secondary" disabled>
        Plan actual
      </Button>
    );
  } else if (plan.nombre === "Pro" && disponible && propietario) {
    accion = <Button onClick={onProbar}>Probar 14 días gratis</Button>;
  } else {
    const texto = plan.caracteristicas.gestor_dedicado
      ? "Hablar con ventas"
      : plan.precio_mensual < suscripcion.plan.precio_mensual
        ? "Cambiar a este plan"
        : "Contratar";
    const enlace = enlaceContratar(suscripcion.soporte, `Plan ${plan.nombre} para ${negocio.nombre}`);
    accion = enlace ? (
      <Button asChild variant="secondary">
        <a href={enlace} target={enlace.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {texto}
        </a>
      </Button>
    ) : (
      <Button variant="secondary" disabled>
        {texto}
      </Button>
    );
  }

  return (
    <Card
      aria-labelledby={titulo}
      className={cn("flex flex-col p-5", recomendado && "border-primary ring-1 ring-primary")}
    >
      <h3 id={titulo} className="flex items-center gap-2 text-title font-bold text-ink">
        {plan.nombre}
        {actual && <Badge tono="neutral">Actual</Badge>}
        {recomendado && <Badge tono="primary">Recomendado</Badge>}
      </h3>
      <p className="mt-3">
        <span className="text-[28px] leading-tight font-bold text-ink">{dinero(plan.precio_mensual)}</span>{" "}
        <span className="text-body text-muted">/mes</span>
      </p>
      <p className="h-5 text-label text-muted">
        {plan.precio_anual > 0 && `o ${dinero(plan.precio_anual)} al año`}
      </p>
      <ul className="mt-3 mb-5 flex flex-1 flex-col gap-2">
        {ventajasPlan(plan, anterior).map((v) => (
          <li key={v} className="flex items-start gap-2 text-body text-ink">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {v}
          </li>
        ))}
      </ul>
      <div className="self-start">{accion}</div>
    </Card>
  );
}

function Contacto({ soporte }: { soporte: Suscripcion["soporte"] }) {
  const { email, whatsapp } = soporte;
  return (
    <Alert tono="info">
      El pago en línea llega pronto.{" "}
      {email || whatsapp ? (
        <>
          Para contratar hoy escríbenos
          {email && (
            <>
              {" "}
              a{" "}
              <a href={`mailto:${email}`} className="font-semibold underline">
                {email}
              </a>
            </>
          )}
          {email && whatsapp && " o"}
          {whatsapp && (
            <>
              {" "}
              por WhatsApp al{" "}
              <a
                href={enlaceWhatsapp(whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                {whatsapp}
              </a>
            </>
          )}
          .
        </>
      ) : (
        "Para contratar hoy, comunícate con PetCat."
      )}
    </Alert>
  );
}
