import { Star } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FiltrosResenas, ResenaPanel, ResumenResenas } from "@/api/resenas";
import { Chips, type Chip } from "@/components/common/Chips";
import { SinPermiso, Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { ReportarDialog } from "../components/ReportarDialog";
import { Estrellas, ResenaCard } from "../components/ResenaCard";
import { useListaResenas } from "../hooks/useResenas";

type Filtro = "todas" | "sin_responder" | "reportadas" | "bajas" | "ocultas" | "retiradas";
type Orden = NonNullable<FiltrosResenas["orden"]>;

const FILTROS: Record<Filtro, FiltrosResenas> = {
  todas: {},
  sin_responder: { sin_responder: true },
  reportadas: { reportada: true },
  bajas: { calificacion_max: 2 },
  ocultas: { estado: "oculta" },
  retiradas: { estado: "retirada" },
};

const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: "recientes", texto: "Más recientes" },
  { valor: "mejores", texto: "Mejor calificadas" },
  { valor: "peores", texto: "Peor calificadas" },
];

const esFiltro = (v: string | null): v is Filtro => v !== null && v in FILTROS;
const esOrden = (v: string | null): v is Orden => ORDENES.some((o) => o.valor === v);

const decimal = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** E3 · Reseñas: resumen, filtros (en la URL), responder y reportar. `?resena=` abre una sola. */
export function ResenasPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const [params, setParams] = useSearchParams();
  const [reportando, setReportando] = useState<ResenaPanel | null>(null);

  const filtro: Filtro = esFiltro(params.get("filtro")) ? (params.get("filtro") as Filtro) : "todas";
  const orden: Orden = esOrden(params.get("orden")) ? (params.get("orden") as Orden) : "recientes";
  const idResena = Number(params.get("resena")) || undefined;
  const filtros: FiltrosResenas = idResena ? { id_resena: idResena } : { ...FILTROS[filtro], orden };

  const verResenas = puede("resenas", "ver");
  const lista = useListaResenas(negocio.id_negocio, filtros, verResenas);

  if (!verResenas) {
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

  const cambiar = (cambios: Record<string, string | null>) =>
    setParams((actuales) => {
      const nuevos = new URLSearchParams(actuales);
      nuevos.delete("resena");
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) nuevos.delete(clave);
        else nuevos.set(clave, valor);
      }
      return nuevos;
    });

  const paginas = lista.data?.pages;
  const resenas = paginas?.flatMap((p) => p.data) ?? [];
  const resumen = paginas?.[0]?.meta.resumen;

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)] items-start gap-5">
      <div className="flex flex-col gap-5">
        <Resumen resumen={resumen} />
        <Card className="p-5">
          <h2 className="mb-3 text-card font-semibold text-ink">Filtros</h2>
          <Chips
            etiqueta="Filtrar reseñas"
            valor={idResena ? ("" as Filtro) : filtro}
            onChange={(valor) => cambiar({ filtro: valor === "todas" ? null : valor })}
            opciones={chips(resumen)}
          />
          <Select
            value={orden}
            onValueChange={(valor) => cambiar({ orden: valor === "recientes" ? null : valor })}
          >
            <SelectTrigger aria-label="Orden" className="mt-4 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDENES.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </div>

      <section aria-label="Reseñas" className="flex flex-col gap-4">
        {idResena && (
          <div className="flex items-center justify-between rounded-control bg-primary-soft px-4 py-2.5 text-body text-primary-dark">
            Mostrando una reseña.
            <Button variant="link" onClick={() => cambiar({})}>
              Ver todas las reseñas
            </Button>
          </div>
        )}
        {lista.isPending ? (
          <>
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </>
        ) : lista.isError ? (
          <Card>
            <ErrorConsulta error={lista.error} reintentar={() => void lista.refetch()} />
          </Card>
        ) : resenas.length === 0 ? (
          <Card>
            <Vacio
              icono={Star}
              titulo={
                idResena
                  ? "No encontramos esa reseña"
                  : filtro === "todas"
                    ? "Todavía no hay reseñas"
                    : "Ninguna reseña con este filtro"
              }
              descripcion={
                filtro === "todas" && !idResena
                  ? "Los clientes pueden reseñar desde la app hasta 30 días después de una cita completada."
                  : undefined
              }
            />
          </Card>
        ) : (
          <>
            {resenas.map((r) => (
              <ResenaCard
                key={r.id_resena}
                resena={r}
                puedeResponder={puede("resenas", "responder")}
                puedeReportar={puede("resenas", "reportar")}
                resaltada={r.id_resena === idResena}
                onReportar={setReportando}
              />
            ))}
            {lista.hasNextPage && (
              <Button
                variant="secondary"
                className="self-center"
                cargando={lista.isFetchingNextPage}
                onClick={() => void lista.fetchNextPage()}
              >
                Cargar más
              </Button>
            )}
          </>
        )}
      </section>
      <ReportarDialog resena={reportando} onCerrar={() => setReportando(null)} />
    </div>
  );
}

/** Chips con sus conteos; "Ocultas" y "Retiradas" solo si hay alguna. */
function chips(resumen: ResumenResenas | undefined): Chip<Filtro>[] {
  const opciones: Chip<Filtro>[] = [
    { valor: "todas", texto: "Todas" },
    { valor: "sin_responder", texto: "Sin responder", contador: resumen?.sin_responder },
    { valor: "reportadas", texto: "Reportadas", contador: resumen?.reportadas },
    { valor: "bajas", texto: "1–2 ★" },
  ];
  if (resumen?.ocultas)
    opciones.push({ valor: "ocultas", texto: "Ocultas por PetCat", contador: resumen.ocultas });
  if (resumen?.retiradas) {
    opciones.push({ valor: "retiradas", texto: "Retiradas por el cliente", contador: resumen.retiradas });
  }
  return opciones;
}

const ESTRELLAS = [1, 2, 3, 4, 5] as const;
type Estrellas = (typeof ESTRELLAS)[number];

function Resumen({ resumen }: { resumen: ResumenResenas | undefined }) {
  if (!resumen) return <Skeleton className="h-56 rounded-card" />;
  const { calificacion_promedio: promedio, total_resenas: total, distribucion, sin_responder } = resumen;
  const conteo = (estrellas: Estrellas) => distribucion[estrellas];
  const maximo = Math.max(1, ...ESTRELLAS.map(conteo));
  return (
    <Card className="p-5">
      <p className="text-[40px] leading-none font-bold text-ink">
        {total > 0 ? decimal.format(promedio) : "—"}
      </p>
      <Estrellas valor={Math.round(promedio)} className="mt-2" />
      <p className="mt-2 text-body text-muted">
        {total === 1 ? "1 reseña" : `${total} reseñas`}
        {sin_responder > 0 && ` · ${sin_responder} sin responder`}
      </p>
      <ul className="mt-4 flex flex-col gap-1.5" aria-label="Reseñas por estrellas">
        {[...ESTRELLAS].reverse().map((n) => (
          <li key={n} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-label text-muted">
            <span>{n} ★</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-track" aria-hidden>
              <span
                className="block h-full rounded-full bg-warning"
                style={{ width: `${(conteo(n) / maximo) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums" aria-label={`${conteo(n)} de ${n} estrellas`}>
              {conteo(n)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
