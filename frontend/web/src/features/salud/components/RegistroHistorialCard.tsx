import { FileText, Image as ImageIcon, Lock, Paperclip } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ArchivoPrivado, RegistroHistorial } from "@/api/salud";
import { Badge } from "@/components/ui/badge";
import { aviso } from "@/components/ui/toaster";
import { nombreCompleto, textoPeso } from "@/features/agenda/textos";
import { abrirArchivoPrivado } from "@/lib/archivos";
import { fechaCorta } from "@/lib/format";
import { textoTipo } from "../textos";

/**
 * Un registro del historial. Los de otro negocio son de solo lectura y nunca traen notas
 * internas (la API solo las envía en los registros propios).
 */
export function RegistroHistorialCard({
  registro: r,
  obtenerArchivo,
}: {
  registro: RegistroHistorial;
  /** Vuelve a pedir el historial y devuelve el archivo con una URL vigente. */
  obtenerArchivo: (idArchivo: number) => Promise<ArchivoPrivado | undefined>;
}) {
  const quien = [r.negocio?.nombre, r.empleado && nombreCompleto(r.empleado)].filter(Boolean).join(" · ");
  const signos = [
    r.peso_registro !== null && `Peso ${textoPeso(r.peso_registro)}`,
    r.temperatura !== null && `Temperatura ${String(r.temperatura).replace(".", ",")} °C`,
    r.frecuencia_cardiaca !== null && `FC ${r.frecuencia_cardiaca} lpm`,
    r.frecuencia_respiratoria !== null && `FR ${r.frecuencia_respiratoria} rpm`,
  ].filter(Boolean);
  const campos: [string, string | null][] = [
    ["Motivo", r.motivo_consulta],
    ["Diagnóstico", r.diagnostico],
    ["Tratamiento", r.tratamiento],
    ["Medicamentos", r.medicamentos_prescritos],
    ["Indicaciones", r.indicaciones],
  ];
  return (
    <article className="rounded-card border bg-white p-4" aria-label={`Registro del ${fechaCorta(r.fecha)}`}>
      <header className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{fechaCorta(r.fecha)}</p>
        <Badge tono="info">{textoTipo(r.tipo)}</Badge>
        {quien && <p className="text-label text-muted">{quien}</p>}
        {!r.es_propio && (
          <Badge className="ml-auto">
            <Lock className="size-3" aria-hidden /> Otro negocio · solo lectura
          </Badge>
        )}
      </header>
      <dl className="mt-2 flex flex-col gap-1 text-body">
        {campos.map(
          ([etiqueta, valor]) =>
            valor && (
              <div key={etiqueta}>
                <dt className="inline text-muted">{etiqueta}: </dt>
                <dd className="inline whitespace-pre-line text-ink">{valor}</dd>
              </div>
            ),
        )}
        {r.proximo_control && (
          <div>
            <dt className="inline text-muted">Próximo control: </dt>
            <dd className="inline text-ink">{fechaCorta(r.proximo_control)}</dd>
          </div>
        )}
      </dl>
      {signos.length > 0 && <p className="mt-1 text-label text-muted">{signos.join(" · ")}</p>}
      {r.archivos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Archivos">
          {r.archivos.map((a, i) => (
            <li key={a.id_archivo ?? `externo-${i}`}>
              <ArchivoChip
                archivo={a}
                obtener={() => (a.id_archivo ? obtenerArchivo(a.id_archivo) : Promise.resolve(a))}
              />
            </li>
          ))}
        </ul>
      )}
      {r.notas_internas && (
        <p className="mt-3 rounded-control bg-warning-soft px-3 py-2 text-body text-warning-ink">
          Nota interna (solo tu negocio): {r.notas_internas}
        </p>
      )}
    </article>
  );
}

/** Botón de un archivo privado: lo abre con una URL vigente (la pide de nuevo si venció). */
export function ArchivoChip({
  archivo,
  obtener,
  children,
}: {
  archivo: ArchivoPrivado;
  obtener: () => Promise<ArchivoPrivado | undefined>;
  children?: ReactNode;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const Icono = archivo.tipo === "pdf" ? FileText : archivo.tipo === "imagen" ? ImageIcon : Paperclip;
  const nombre = archivo.nombre ?? (archivo.tipo === "pdf" ? "Documento PDF" : "Archivo");
  return (
    <button
      type="button"
      disabled={abriendo}
      onClick={async () => {
        setAbriendo(true);
        const abierto = await abrirArchivoPrivado(archivo, obtener);
        setAbriendo(false);
        if (!abierto) aviso.error("No se pudo abrir el archivo. Intenta de nuevo.");
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-surface px-3 text-label font-medium text-ink hover:border-primary hover:text-primary disabled:opacity-60"
    >
      <Icono className="size-3.5" aria-hidden />
      {children ?? nombre}
    </button>
  );
}
