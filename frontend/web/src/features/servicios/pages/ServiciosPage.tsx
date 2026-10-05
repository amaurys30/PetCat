import { Plus, Search, TriangleAlert, Wrench } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Servicio } from "@/api/servicios";
import { SinPermiso, Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { aviso } from "@/components/ui/toaster";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { ServicioCard } from "../components/ServicioCard";
import { useEstadoServicio } from "../components/EstadoServicio";
import { useCatalogoServicios, useCategoriasServicio, useVisibilidadServicio } from "../hooks/useServicios";
import { reservableDesdeApp, sinProfesionales } from "../textos";

type Estado = "activos" | "inactivos" | "todos" | "sin_profesionales";

const ESTADOS: { valor: Estado; texto: string }[] = [
  { valor: "activos", texto: "Activos" },
  { valor: "inactivos", texto: "Inactivos" },
  { valor: "todos", texto: "Todos" },
  { valor: "sin_profesionales", texto: "Sin profesionales" },
];

/** Sin tildes ni mayúsculas, para buscar "bano" y encontrar "Baño". */
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");

const FILTRO_ESTADO: Record<Estado, (s: Servicio) => boolean> = {
  activos: (s) => s.activo,
  inactivos: (s) => !s.activo,
  todos: () => true,
  sin_profesionales: sinProfesionales,
};

/**
 * D1 · Catálogo de servicios. Carga todo el catálogo y filtra en el navegador: el
 * encabezado y el aviso de servicios sin profesionales cuentan todos los servicios.
 */
export function ServiciosPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const catalogo = useCatalogoServicios(negocio.id_negocio, puede("servicios", "ver"));
  const categorias = useCategoriasServicio();
  const visibilidad = useVisibilidadServicio();
  const estado = useEstadoServicio((s) => String(s.id_servicio));

  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(useDeferredValue(busqueda.trim()));
  const [categoria, setCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState<Estado>("activos");

  const iconos = useMemo(
    () => new Map((categorias.data ?? []).map((c) => [c.id_categoria, c.icono])),
    [categorias.data],
  );
  const servicios = catalogo.data ?? [];
  const activos = servicios.filter((s) => s.activo);
  const sinPro = servicios.filter(sinProfesionales);
  const visibles = servicios.filter(
    (s) =>
      FILTRO_ESTADO[filtroEstado](s) &&
      (categoria === "todas" || String(s.categoria.id_categoria) === categoria) &&
      (!q || normalizar(`${s.nombre} ${s.descripcion ?? ""} ${s.categoria.nombre}`).includes(q)),
  );
  // Las categorías que usa el negocio, en el orden del catálogo.
  const categoriasUsadas = (categorias.data ?? []).filter((c) =>
    servicios.some((s) => s.categoria.id_categoria === c.id_categoria),
  );

  if (!puede("servicios", "ver")) {
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

  const cambiarVisibilidad = (s: Servicio) =>
    visibilidad.mutate(
      { idServicio: s.id_servicio, visible: !s.visible_app },
      {
        onSuccess: () =>
          aviso.exito(
            s.visible_app ? `«${s.nombre}» ya no aparece en la app` : `«${s.nombre}» aparece en la app`,
          ),
      },
    );

  return (
    <div>
      <p className="mb-4 text-body text-muted" aria-live="polite">
        {catalogo.data
          ? `${activos.length} ${activos.length === 1 ? "servicio activo" : "servicios activos"} · ${
              servicios.filter(reservableDesdeApp).length
            } reservables desde la app`
          : " "}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            type="search"
            aria-label="Buscar servicio"
            placeholder="Buscar servicio…"
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-56" aria-label="Categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categoriasUsadas.map((c) => (
              <SelectItem key={c.id_categoria} value={String(c.id_categoria)}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as Estado)}>
          <SelectTrigger className="w-48" aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e.valor} value={e.valor}>
                {e.texto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {puede("servicios", "crear") && (
          <Button asChild className="ml-auto">
            <Link to="nuevo">
              <Plus /> Nuevo servicio
            </Link>
          </Button>
        )}
      </div>

      {sinPro.length > 0 && (
        <AvisoSinProfesionales
          servicios={sinPro}
          puedeAsignar={puede("servicios", "editar")}
          onVerTodos={() => setFiltroEstado("sin_profesionales")}
        />
      )}

      {catalogo.isPending ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-card" />
          ))}
        </div>
      ) : catalogo.isError ? (
        <Card>
          <ErrorConsulta error={catalogo.error} reintentar={() => void catalogo.refetch()} />
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          {servicios.length === 0 ? (
            <Vacio
              icono={Wrench}
              titulo="Crea tu primer servicio"
              descripcion="Los servicios son lo que tus clientes reservan desde la app: consulta, baño, vacunas…"
              acciones={
                puede("servicios", "crear") && (
                  <Button asChild>
                    <Link to="nuevo">
                      <Plus /> Nuevo servicio
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <Vacio
              icono={Search}
              titulo="Ningún servicio coincide"
              descripcion="Prueba con otra búsqueda, otra categoría u otro estado."
            />
          )}
        </Card>
      ) : (
        <ul className="grid grid-cols-3 gap-4" aria-label="Servicios">
          {visibles.map((s) => (
            <li key={s.id_servicio} className="flex">
              <ServicioCard
                servicio={s}
                icono={iconos.get(s.categoria.id_categoria)}
                onDesactivar={() => estado.desactivar(s)}
                onReactivar={() => estado.reactivar(s)}
                onVisibilidad={() => cambiarVisibilidad(s)}
              />
            </li>
          ))}
        </ul>
      )}

      {estado.dialogos}
    </div>
  );
}

function AvisoSinProfesionales({
  servicios,
  puedeAsignar,
  onVerTodos,
}: {
  servicios: Servicio[];
  puedeAsignar: boolean;
  onVerTodos: () => void;
}) {
  const [primero] = servicios;
  if (!primero) return null;
  const uno = servicios.length === 1;
  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-4 rounded-control bg-warning-soft px-4 py-2.5 text-body text-warning-ink"
    >
      <span className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {uno
          ? `«${primero.nombre}» no tiene profesionales asignados: ${
              primero.visible_app ? "aparece en la app pero no se puede reservar" : "no se puede reservar"
            }.`
          : `${servicios.length} servicios no tienen profesionales asignados: no se pueden reservar.`}
      </span>
      {uno ? (
        puedeAsignar && (
          <Link
            to={`${primero.id_servicio}#profesionales`}
            className="shrink-0 font-semibold hover:underline"
          >
            Asignar →
          </Link>
        )
      ) : (
        <button type="button" onClick={onVerTodos} className="shrink-0 font-semibold hover:underline">
          Ver cuáles →
        </button>
      )}
    </div>
  );
}
