import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { getEmpleados, type Empleado } from "@/api/empleados";
import type { NegocioGestion } from "@/api/negocios";
import type { Suscripcion } from "@/api/types";
import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNegocioActivo, usePuede, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { TIPOS_NEGOCIO } from "@/features/negocios/textos";
import { BarraUso } from "@/features/suscripcion/components/BarraUso";
import { agruparDias, semanaDesdeApi } from "@/lib/horarios";
import { puedeActivarPrueba } from "@/lib/permisos";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useConfiguracion } from "../contexto";

/** E0 · Resumen del negocio: perfil, sedes con horario, plan, equipo y reglas de agenda. */
export function ResumenNegocioPage() {
  const { negocio, puedeEditar } = useConfiguracion();
  const puede = usePuede();
  const suscripcion = useSuscripcion(negocio.id_negocio);

  return (
    <div className="grid grid-cols-[1fr_380px] items-start gap-5">
      <div className="flex flex-col gap-5">
        <Perfil negocio={negocio} puedeEditar={puedeEditar} />
        <Sedes negocio={negocio} puedeEditar={puedeEditar} />
      </div>
      <div className="flex flex-col gap-5">
        <PlanActual suscripcion={suscripcion.data} />
        {puede("empleados", "ver") && (
          <Equipo idNegocio={negocio.id_negocio} puedeCrear={puede("empleados", "crear")} />
        )}
        <ReglasAgenda negocio={negocio} />
        <Card className="border-dashed bg-surface p-5">
          <h2 className="flex items-center gap-2 text-card font-semibold text-muted">
            Integraciones <Badge tono="neutral">Próximamente</Badge>
          </h2>
          <p className="mt-1 text-label text-muted">Pagos en línea con MercadoPago llegan en la Fase 3.</p>
        </Card>
      </div>
    </div>
  );
}

function Encabezado({ titulo, enlace }: { titulo: string; enlace?: { a: string; texto: string } | false }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-card font-semibold text-ink">{titulo}</h2>
      {enlace && (
        <Link
          to={enlace.a}
          className="flex items-center gap-1 text-body font-semibold text-primary hover:underline"
        >
          {enlace.texto} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-body">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function Perfil({ negocio, puedeEditar }: { negocio: NegocioGestion; puedeEditar: boolean }) {
  const juntar = (...partes: (string | null)[]) => partes.filter(Boolean).join(" · ");
  return (
    <Card className="p-5">
      <div className="h-28 overflow-hidden rounded-card bg-primary-soft">
        {negocio.banner_url && <img src={negocio.banner_url} alt="" className="size-full object-cover" />}
      </div>
      <div className="mt-4 flex items-start gap-4">
        <Avatar nombre={negocio.nombre} fotoUrl={negocio.logo_miniatura_url} tamano="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-bold text-ink">{negocio.nombre}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tono="neutral">{TIPOS_NEGOCIO[negocio.tipo]}</Badge>
            {negocio.verificado && (
              <Badge tono="info">
                <BadgeCheck className="size-3" aria-hidden /> Verificado
              </Badge>
            )}
            {negocio.total_resenas > 0 && (
              <Badge tono="warning">
                <Star className="size-3" aria-hidden /> {negocio.calificacion_promedio.toFixed(1)} ·{" "}
                {negocio.total_resenas} reseñas
              </Badge>
            )}
            {!negocio.activo && <Badge tono="danger">Inactivo</Badge>}
          </div>
        </div>
        {puedeEditar && (
          <Button asChild variant="secondary">
            <Link to="../perfil">Editar perfil</Link>
          </Button>
        )}
      </div>
      {negocio.descripcion && <p className="mt-4 text-body text-muted">{negocio.descripcion}</p>}
      <dl className="mt-4 flex flex-col gap-2">
        <Dato etiqueta="Teléfono">
          {juntar(negocio.telefono, negocio.whatsapp && `WhatsApp ${negocio.whatsapp}`) || "—"}
        </Dato>
        <Dato etiqueta="Correo">{negocio.email ?? "—"}</Dato>
        <Dato etiqueta="NIT">{juntar(negocio.nit, negocio.razon_social) || "—"}</Dato>
        <Dato etiqueta="Sitio web">
          {negocio.sitio_web ? (
            <a
              href={negocio.sitio_web}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {negocio.sitio_web.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            "—"
          )}
        </Dato>
      </dl>
    </Card>
  );
}

function Sedes({ negocio, puedeEditar }: { negocio: NegocioGestion; puedeEditar: boolean }) {
  return (
    <Card className="p-5">
      <Encabezado
        titulo="Sedes y horarios"
        enlace={puedeEditar && { a: "../sedes", texto: "Editar horarios" }}
      />
      {negocio.sucursales.length === 0 && <p className="text-body text-muted">Todavía no hay sedes.</p>}
      <ul className="flex flex-col gap-3">
        {negocio.sucursales.map((s) => (
          <li key={s.id_sucursal} className="rounded-card bg-surface p-3.5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-body font-semibold text-ink">{s.nombre}</span>
              {s.es_principal && <Badge tono="primary">Principal</Badge>}
              {(s.latitud === null || s.longitud === null) && <Badge tono="warning">Sin ubicación</Badge>}
            </p>
            <dl className="mt-1.5 flex flex-col gap-0.5">
              {agruparDias(semanaDesdeApi(s.horarios)).map((g) => (
                <div key={g.dias} className="flex justify-between gap-3 text-body">
                  <dt className="text-muted">{g.dias}</dt>
                  <dd className={cn("tabular-nums", g.horario === "Cerrado" ? "text-subtle" : "text-ink")}>
                    {g.horario}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const ESTADO_SUSCRIPCION = { activa: "Activo", en_prueba: "En prueba", vencida: "Vencido" } as const;

function PlanActual({ suscripcion }: { suscripcion: Suscripcion | undefined }) {
  const usuario = useAuth((s) => s.usuario);
  const negocio = useNegocioActivo();
  return (
    <Card className="p-5">
      <Encabezado titulo="Plan actual" enlace={{ a: "../../suscripcion", texto: "Ver planes" }} />
      {!suscripcion ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2">
            <span className="text-title font-bold text-ink">{suscripcion.plan.nombre}</span>
            <Badge tono={suscripcion.suscripcion?.estado === "en_prueba" ? "info" : "primary"}>
              {ESTADO_SUSCRIPCION[suscripcion.suscripcion?.estado ?? "activa"]}
            </Badge>
          </p>
          <BarraUso etiqueta="Citas este mes" uso={suscripcion.uso.citas_mes} />
          <BarraUso etiqueta="Empleados" uso={suscripcion.uso.empleados} />
          {suscripcion.prueba_disponible && puedeActivarPrueba(usuario, negocio) && (
            <Button asChild className="self-start">
              <Link to="../../suscripcion">Probar Pro 14 días</Link>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

const estadoMiembro = (e: Empleado): { texto: string; tono: "primary" | "warning" | "neutral" } =>
  !e.activo
    ? { texto: "Inactivo", tono: "neutral" }
    : e.tiene_cuenta
      ? { texto: "Activo", tono: "primary" }
      : e.invitacion_pendiente
        ? { texto: "Invitación pendiente", tono: "warning" }
        : { texto: "Sin invitar", tono: "neutral" };

function Equipo({ idNegocio, puedeCrear }: { idNegocio: number; puedeCrear: boolean }) {
  const params = { limit: 3, activo: true };
  const empleados = useQuery({
    queryKey: queryKeys.empleados.lista(idNegocio, params),
    queryFn: () => getEmpleados(idNegocio, params),
  });
  return (
    <Card className="p-5">
      <Encabezado titulo="Equipo" enlace={{ a: "../../equipo", texto: "Ver equipo" }} />
      {!empleados.data ? (
        <Skeleton className="h-20" />
      ) : empleados.data.data.length === 0 ? (
        <p className="text-body text-muted">Todavía no hay miembros en el equipo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {empleados.data.data.map((e) => {
            const estado = estadoMiembro(e);
            return (
              <li key={e.id_empleado} className="flex items-center gap-3">
                <Avatar nombre={`${e.nombre} ${e.apellido}`} fotoUrl={e.foto_miniatura_url} tono="suave" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">
                    {e.nombre} {e.apellido}
                  </span>
                  <span className="block text-label text-muted">{e.especialidad ?? e.rol.nombre}</span>
                </span>
                <Badge tono={estado.tono}>{estado.texto}</Badge>
              </li>
            );
          })}
        </ul>
      )}
      {puedeCrear && (
        <Link
          to="../../equipo"
          className="mt-3 inline-block text-body font-semibold text-primary hover:underline"
        >
          + Agregar miembro
        </Link>
      )}
    </Card>
  );
}

function ReglasAgenda({ negocio }: { negocio: NegocioGestion }) {
  const { confirmacion_automatica, plazo_confirmacion_h } = negocio.reglas_confirmacion;
  return (
    <Card className="p-5">
      <Encabezado titulo="Reglas de agenda" enlace={{ a: "../perfil", texto: "Cambiar" }} />
      <dl className="flex flex-col gap-2">
        <Dato etiqueta="Confirmación">
          {confirmacion_automatica ? "Automática" : `Manual · plazo de ${plazo_confirmacion_h} h`}
        </Dato>
        <Dato etiqueta="Pendientes">
          {confirmacion_automatica
            ? "Las reservas de la app nacen confirmadas"
            : "Se cancelan solas si no se confirman"}
        </Dato>
      </dl>
    </Card>
  );
}
