import { Paperclip, Pencil, Plus, Syringe } from "lucide-react";
import { useState } from "react";
import type { Vacuna } from "@/api/salud";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { nombreCompleto } from "@/features/agenda/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { useUi } from "@/stores/ui";
import { fechaCorta, fechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVacunas } from "../hooks/useSalud";
import { ESTADO_VACUNA, fechaCompacta } from "../textos";
import { ArchivoChip } from "./RegistroHistorialCard";

/** Quién registró la vacuna: el dueño (con clip si subió comprobante) o el negocio. */
function Registro({ vacuna: v }: { vacuna: Vacuna }) {
  if (v.registrada_por === "dueno") {
    return (
      <Tooltip
        texto={
          v.tiene_comprobante
            ? "La registró el dueño y subió el comprobante"
            : "La registró el dueño, sin comprobante"
        }
      >
        <span>
          <Badge tono="info">
            Dueño
            {v.tiene_comprobante && <Paperclip className="size-3" aria-label="con comprobante" />}
          </Badge>
        </span>
      </Tooltip>
    );
  }
  return (
    <span className="block max-w-20 truncate text-body text-ink" title={v.negocio?.nombre}>
      {v.negocio?.nombre ?? "Un negocio"}
    </span>
  );
}

/** Vacunas vigentes primero (las anteriores, "No aplica", al final), por fecha de aplicación. */
const ordenar = (vacunas: Vacuna[]) =>
  [...vacunas].sort(
    (a, b) =>
      Number(a.estado === "no_aplica") - Number(b.estado === "no_aplica") ||
      b.fecha_aplicacion.localeCompare(a.fecha_aplicacion),
  );

/**
 * Carnet de vacunas (vacunas.ver). Siempre visible, también sin compartir_historial, para
 * evitar revacunaciones. `completo` agrega lote, laboratorio, comprobante y las dosis
 * anteriores (pestaña Vacunas); si no, es el resumen de la columna derecha.
 */
export function Vacunas({ idMascota, completo = false }: { idMascota: number; completo?: boolean }) {
  const negocio = useNegocioActivo();
  const vacunas = useVacunas(negocio.id_negocio, idMascota, true);
  const puedeEditar = usePuede()("vacunas", "editar");
  const abrirVacuna = useUi((s) => s.abrirVacuna);
  // Solo las que registró este negocio; las del dueño o de otro negocio son de solo lectura.
  const esPropia = (v: Vacuna) =>
    puedeEditar && v.registrada_por === "negocio" && v.negocio?.id_negocio === negocio.id_negocio;
  // En el resumen de la columna derecha, el año corto ("13 sep 25"), como el mockup.
  const fecha = completo ? fechaCorta : fechaCompacta;
  const [anteriores, setAnteriores] = useState(false);

  if (vacunas.isPending) return <Skeleton className="h-40" />;
  if (vacunas.isError)
    return <ErrorConsulta error={vacunas.error} reintentar={() => void vacunas.refetch()} />;
  const todas = ordenar(vacunas.data);
  const visibles = completo && anteriores ? todas : todas.filter((v) => v.estado !== "no_aplica");
  const cuantasAnteriores = todas.length - todas.filter((v) => v.estado !== "no_aplica").length;

  const obtener = (idVacuna: number) => async () => {
    const r = await vacunas.refetch();
    return r.data?.find((v) => v.id_vacuna === idVacuna)?.comprobante ?? undefined;
  };

  if (todas.length === 0) {
    return <Vacio icono={Syringe} titulo="Sin vacunas registradas" className="py-8" />;
  }
  return (
    <div className="flex flex-col gap-3">
      {completo && cuantasAnteriores > 0 && (
        <label className="flex items-center justify-end gap-2 text-body text-muted">
          <Switch checked={anteriores} onCheckedChange={setAnteriores} />
          Ver dosis anteriores ({cuantasAnteriores})
        </label>
      )}
      <div className="overflow-hidden rounded-card border">
        <table className="w-full text-left text-body">
          <thead className="bg-track text-label font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2.5">Vacuna</th>
              <th className="px-3 py-2.5">Aplicada</th>
              <th className="px-3 py-2.5">Próxima</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5">Registró</th>
              {completo && <th className="px-3 py-2.5">Detalle</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => {
              const estado = ESTADO_VACUNA[v.estado];
              return (
                <tr key={v.id_vacuna} className={cn("border-t", v.estado === "no_aplica" && "text-muted")}>
                  <td className="px-3 py-2.5">
                    <span className="block font-medium">{v.nombre_vacuna}</span>
                    {v.edicion && <Edicion vacuna={v} completo={completo} />}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fecha(v.fecha_aplicacion)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {v.fecha_proxima ? fecha(v.fecha_proxima) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tono={estado.tono}>{estado.texto}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Registro vacuna={v} />
                  </td>
                  {completo && (
                    <td className="px-3 py-2.5">
                      <span className="block text-label text-muted">
                        {[v.dosis, v.laboratorio, v.lote && `Lote ${v.lote}`].filter(Boolean).join(" · ") ||
                          "—"}
                      </span>
                      {v.comprobante && (
                        <span className="mt-1 block">
                          <ArchivoChip archivo={v.comprobante} obtener={obtener(v.id_vacuna)}>
                            Comprobante
                          </ArchivoChip>
                        </span>
                      )}
                      {esPropia(v) && (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto px-0"
                          aria-label={`Editar ${v.nombre_vacuna}`}
                          onClick={() => abrirVacuna({ idMascota, vacuna: v })}
                        >
                          <Pencil /> Editar
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!completo && (
        <p className="text-label text-muted">
          Las vacunas registradas por el dueño se marcan "Dueño"; el clip indica que subió el comprobante.
        </p>
      )}
    </div>
  );
}

export function CarnetVacunas({ idMascota, fallecido }: { idMascota: number; fallecido: boolean }) {
  const puedeCrear = usePuede()("vacunas", "crear");
  const abrirVacuna = useUi((s) => s.abrirVacuna);
  return (
    <Card className="p-4" role="region" aria-label="Carnet de vacunas">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-card font-semibold text-ink">Carnet de vacunas</h3>
        {puedeCrear && !fallecido && (
          <Button variant="link" size="sm" onClick={() => abrirVacuna({ idMascota })}>
            <Plus /> Vacuna
          </Button>
        )}
      </div>
      <Vacunas idMascota={idMascota} />
    </Card>
  );
}

/** "Editado por X · fecha": completo en la pestaña Vacunas; en el carnet angosto, con un tooltip. */
function Edicion({ vacuna: v, completo }: { vacuna: Vacuna; completo: boolean }) {
  const texto = `Editado por ${v.edicion!.usuario ? nombreCompleto(v.edicion!.usuario) : "un ex miembro del equipo"} · ${fechaHora(v.edicion!.fecha)}${v.ediciones > 1 ? ` · ${v.ediciones} ediciones` : ""}`;
  if (completo) return <span className="block text-label text-subtle">{texto}</span>;
  return (
    <Tooltip texto={texto}>
      <span className="text-label text-subtle underline decoration-dotted">editada</span>
    </Tooltip>
  );
}
