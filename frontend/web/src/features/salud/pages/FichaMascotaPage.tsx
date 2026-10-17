import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { CitaPanel } from "@/api/citas";
import type { ResumenSalud } from "@/api/salud";
import { Avatar } from "@/components/common/Avatar";
import { SinPermiso, Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { nombreCompleto, textoEdad, textoPeso } from "@/features/agenda/textos";
import { TablaCitas } from "@/features/clientes/components/TablaCitas";
import { diaCorto, textoEspecie } from "@/features/clientes/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { useUi } from "@/stores/ui";
import { fechaCorta, parseFecha } from "@/lib/format";
import { GraficoPeso } from "../components/GraficoPeso";
import { HistorialPestana } from "../components/HistorialPestana";
import { CarnetVacunas, Vacunas } from "../components/Vacunas";
import { useCitasMascota, useResumenSalud } from "../hooks/useSalud";
import { haceCuanto, microchipCorto, SEXO, textoTipo } from "../textos";

type Pestana = "historial" | "vacunas" | "citas";

/**
 * C2 · Ficha de la mascota (solo lectura en P5.2): cabecera, resumen de salud, historial,
 * vacunas y citas con el negocio. Requiere historial_medico.ver o vacunas.ver y una cita
 * válida con la mascota (la API responde 403 si no la hay). Las pestañas siguen los permisos.
 */
export function FichaMascotaPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const idMascota = Number(useParams().idMascota);
  const verHistorial = puede("historial_medico", "ver");
  const verVacunas = puede("vacunas", "ver");
  const resumen = useResumenSalud(negocio.id_negocio, idMascota);

  if (!verHistorial && !verVacunas) {
    return (
      <Card>
        <SinPermiso descripcion="Tu rol no incluye el historial médico ni las vacunas." />
      </Card>
    );
  }
  if (resumen.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-label="Cargando ficha">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (resumen.isError) {
    return (
      <Card>
        {resumen.error.status === 403 && !resumen.error.limitePlan ? (
          <SinPermiso
            descripcion={`${resumen.error.message}. Un negocio ve la ficha de una mascota cuando tiene al menos una cita con ella.`}
          />
        ) : (
          <ErrorConsulta error={resumen.error} reintentar={() => void resumen.refetch()} />
        )}
      </Card>
    );
  }
  return <Ficha resumen={resumen.data} verHistorial={verHistorial} verVacunas={verVacunas} />;
}

function Ficha({
  resumen,
  verHistorial,
  verVacunas,
}: {
  resumen: ResumenSalud;
  verHistorial: boolean;
  verVacunas: boolean;
}) {
  const puede = usePuede();
  const [params, setParams] = useSearchParams();
  const verCitas = puede("citas", "ver") || puede("clientes", "ver");
  const pestanas: { valor: Pestana; texto: string }[] = [
    ...(verHistorial ? [{ valor: "historial" as const, texto: "Historial médico" }] : []),
    ...(verVacunas ? [{ valor: "vacunas" as const, texto: "Vacunas" }] : []),
    ...(verCitas ? [{ valor: "citas" as const, texto: "Citas" }] : []),
  ];
  const pedida = params.get("pestana") as Pestana | null;
  const pestana = pestanas.find((p) => p.valor === pedida)?.valor ?? pestanas[0]?.valor;
  const m = resumen.mascota;

  return (
    <div className="flex flex-col gap-4">
      <Cabecera resumen={resumen} />
      <ResumenTarjetas resumen={resumen} />
      <div className="grid grid-cols-[minmax(0,1fr)_460px] items-start gap-4">
        {pestana ? (
          <Tabs
            value={pestana}
            onValueChange={(v) =>
              setParams(
                (p) => {
                  p.set("pestana", v);
                  return p;
                },
                { replace: true },
              )
            }
          >
            <TabsList aria-label="Secciones de la ficha">
              {pestanas.map((p) => (
                <TabsTrigger key={p.valor} value={p.valor}>
                  {p.texto}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="historial" className="mt-3">
              <HistorialPestana idMascota={m.id_mascota} comparte={m.compartir_historial} />
            </TabsContent>
            <TabsContent value="vacunas" className="mt-3">
              <Vacunas idMascota={m.id_mascota} completo />
            </TabsContent>
            <TabsContent value="citas" className="mt-3">
              <CitasPestana idMascota={m.id_mascota} />
            </TabsContent>
          </Tabs>
        ) : (
          <div />
        )}
        {verVacunas && <CarnetVacunas idMascota={m.id_mascota} />}
      </div>
    </div>
  );
}

function Cabecera({ resumen }: { resumen: ResumenSalud }) {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const abrirRegistro = useUi((s) => s.abrirRegistroMedico);
  const { mascota: m, dueno } = resumen;
  const verClientes = puede("clientes", "ver");
  const base = `/n/${negocio.id_negocio}/clientes`;
  const nacimiento = m.fecha_nacimiento
    ? `${textoEdad(m.edad_meses)} (${format(parseFecha(m.fecha_nacimiento), "d MMM yyyy", { locale: es }).replace(".", "")})`
    : null;
  const detalle = [
    textoEspecie(m.especie),
    m.raza,
    SEXO[m.sexo],
    nacimiento,
    textoPeso(m.peso),
    m.esterilizado && (m.sexo === "hembra" ? "Esterilizada" : "Esterilizado"),
  ].filter(Boolean);

  return (
    <Card className="p-5">
      <nav aria-label="Ruta" className="mb-3 flex items-center gap-1 text-label text-muted">
        {verClientes ? (
          <>
            <Link to={base} className="hover:text-primary hover:underline">
              Clientes
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <Link to={`${base}?cliente=${dueno.id_usuario}`} className="hover:text-primary hover:underline">
              {nombreCompleto(dueno)}
            </Link>
          </>
        ) : (
          <span>{nombreCompleto(dueno)}</span>
        )}
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-ink">{m.nombre}</span>
      </nav>
      <div className="flex items-start gap-4">
        {m.foto_miniatura_url ? (
          <Avatar nombre={m.nombre} fotoUrl={m.foto_miniatura_url} tamano="xl" />
        ) : (
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-done-soft text-[22px] font-bold text-done"
            aria-hidden
          >
            {m.nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-bold text-ink">
            {m.nombre} <span className="font-normal text-muted">· {nombreCompleto(dueno)}</span>
          </h2>
          <p className="text-body text-muted">
            {detalle.join(" · ")}
            {m.microchip && (
              <>
                {" · "}
                <span title={m.microchip}>Microchip {microchipCorto(m.microchip)}</span>
              </>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {m.tiene_alergias && (
              <Badge tono="danger">
                <TriangleAlert className="size-3" aria-hidden /> Alergia:{" "}
                {m.alergias_detalle ?? "sin detalle"}
              </Badge>
            )}
            {m.condiciones_medicas && <Badge tono="warning">Condición: {m.condiciones_medicas}</Badge>}
            {m.compartir_historial ? (
              <Badge tono="primary">Comparte su historial completo</Badge>
            ) : (
              <Tooltip texto="Ves solo los registros de tu negocio; las vacunas, alergias y condiciones se ven siempre">
                <span>
                  <Badge>No comparte el historial de otros negocios</Badge>
                </span>
              </Tooltip>
            )}
            {m.fallecido && (
              <Badge>
                Fallecido{m.fecha_fallecimiento ? ` el ${fechaCorta(m.fecha_fallecimiento)}` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {puede("historial_medico", "crear") && (
            <Button onClick={() => abrirRegistro({ idMascota: m.id_mascota })}>
              <Plus /> Registro médico
            </Button>
          )}
          {puede("vacunas", "crear") && (
            <Tooltip texto="Llega en P5.4">
              <span>
                <Button variant="secondary" disabled>
                  <Plus /> Vacuna
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-4">
      <p className="text-label text-muted">{titulo}</p>
      {children}
    </Card>
  );
}

function ResumenTarjetas({ resumen: r }: { resumen: ResumenSalud }) {
  const vencida = r.vacunas_vencidas[0];
  const control = r.ultimo_control;
  const queControl = control
    ? [control.tipo ? textoTipo(control.tipo) : control.servicio?.nombre, control.negocio?.nombre]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <div className="grid grid-cols-5 gap-4" aria-label="Resumen de salud">
      <Tarjeta titulo="Vacunas vencidas">
        <p className={`text-title font-bold ${r.vacunas_vencidas.length ? "text-danger" : "text-ink"}`}>
          {r.vacunas_vencidas.length}
        </p>
        <p className="truncate text-label text-muted">
          {vencida ? `${vencida.nombre_vacuna} · ${haceCuanto(vencida.fecha_proxima)}` : "Ninguna"}
        </p>
      </Tarjeta>
      <Tarjeta titulo="Próximas (30 días)">
        <p className={`text-title font-bold ${r.vacunas_proximas.length ? "text-warning-ink" : "text-ink"}`}>
          {r.vacunas_proximas.length}
        </p>
        <p className="truncate text-label text-muted">
          {r.vacunas_proximas.map((v) => `${v.nombre_vacuna} ${fechaCorta(v.fecha_proxima)}`).join(" · ") ||
            "Ninguna"}
        </p>
      </Tarjeta>
      <Tarjeta titulo="Último control">
        <p className="text-title font-bold text-ink">{control ? haceCuanto(control.fecha) : "—"}</p>
        <p className="truncate text-label text-muted">{queControl || "Sin controles"}</p>
      </Tarjeta>
      <Tarjeta titulo="Próxima cita">
        <p className="text-title font-bold text-ink">
          {r.proxima_cita ? diaCorto(r.proxima_cita.fecha) : "—"}
        </p>
        <p className="truncate text-label text-muted">
          {r.proxima_cita
            ? `${r.proxima_cita.hora_inicio} · ${r.proxima_cita.servicio.nombre}`
            : r.proximo_control
              ? `Control indicado: ${fechaCorta(r.proximo_control.fecha)}`
              : "Sin cita con tu negocio"}
        </p>
      </Tarjeta>
      <Card className="p-4">
        <GraficoPeso evolucion={r.evolucion_peso} />
      </Card>
    </div>
  );
}

function CitasPestana({ idMascota }: { idMascota: number }) {
  const negocio = useNegocioActivo();
  const puedeAgenda = usePuede()("citas", "ver");
  const navigate = useNavigate();
  const citas = useCitasMascota(negocio.id_negocio, idMascota, true);
  if (citas.isPending) return <Skeleton className="h-40" />;
  if (citas.isError) return <ErrorConsulta error={citas.error} reintentar={() => void citas.refetch()} />;
  const filas = citas.data.pages.flatMap((p) => p.data);
  if (filas.length === 0)
    return <Vacio icono={CalendarDays} titulo="Sin citas con tu negocio" className="py-8" />;
  const abrir = puedeAgenda
    ? (c: CitaPanel) => void navigate(`/n/${negocio.id_negocio}/agenda?fecha=${c.fecha}&cita=${c.id_cita}`)
    : undefined;
  return (
    <div className="flex flex-col gap-3">
      <TablaCitas citas={filas} onAbrir={abrir} />
      {citas.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void citas.fetchNextPage()}
          disabled={citas.isFetchingNextPage}
        >
          Cargar más
        </Button>
      )}
    </div>
  );
}
