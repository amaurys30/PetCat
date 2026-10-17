import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Avatar } from "@/components/common/Avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { nombreCompleto } from "@/features/agenda/textos";
import { useBusquedaClientes } from "@/features/clientes/hooks/useClientes";
import { plural } from "@/features/clientes/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";

const CLASES_INPUT =
  "h-9 w-full rounded-control border-0 bg-surface pr-3 pl-9 text-body placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

/**
 * Búsqueda del Topbar: clientes del negocio por nombre, correo, teléfono o nombre de su
 * mascota (hasta 5), y al elegir uno se abre en Clientes. Requiere clientes.ver. La API no
 * busca citas: se encuentran desde la agenda o el detalle del cliente.
 */
export function BuscadorClientes() {
  const negocio = useNegocioActivo();
  const puede = usePuede()("clientes", "ver");
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const resultados = useBusquedaClientes(negocio.id_negocio, q, puede);

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  if (!puede) {
    return (
      <Tooltip texto="Necesitas permiso para ver clientes">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            disabled
            aria-label="Buscar cliente o mascota"
            placeholder="Buscar cliente o mascota…"
            className={CLASES_INPUT}
          />
        </div>
      </Tooltip>
    );
  }

  const ir = (idUsuario: number) => {
    setAbierto(false);
    setTexto("");
    void navigate(`/n/${negocio.id_negocio}/clientes?cliente=${idUsuario}`);
  };
  const filas = resultados.data ?? [];
  const mostrar = abierto && q.length >= 2;

  return (
    <div
      ref={contenedor}
      className="relative w-72"
      onBlur={(e) => {
        if (!contenedor.current?.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setAbierto(false);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input
        type="search"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls="resultados-busqueda"
        aria-label="Buscar cliente o mascota"
        placeholder="Buscar cliente o mascota…"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filas[0]) ir(filas[0].id_usuario);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            contenedor.current?.querySelector<HTMLButtonElement>("[data-resultado]")?.focus();
          }
        }}
        className={CLASES_INPUT}
      />
      {mostrar && (
        <div
          id="resultados-busqueda"
          className="absolute top-11 right-0 left-0 z-50 rounded-card border bg-white p-1 shadow-lg"
        >
          {resultados.isPending ? (
            <p className="px-3 py-2 text-body text-muted">Buscando…</p>
          ) : resultados.isError ? (
            <p className="px-3 py-2 text-body text-danger">{resultados.error.message}</p>
          ) : filas.length === 0 ? (
            <p className="px-3 py-2 text-body text-muted">Ningún cliente coincide con "{q}".</p>
          ) : (
            <ul aria-label="Resultados de la búsqueda">
              {filas.map((c, i) => (
                <li key={c.id_usuario}>
                  <button
                    type="button"
                    data-resultado
                    onClick={() => ir(c.id_usuario)}
                    onKeyDown={(e) => {
                      const botones =
                        contenedor.current?.querySelectorAll<HTMLButtonElement>("[data-resultado]");
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        botones?.[i + 1]?.focus();
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        botones?.[i - 1]?.focus();
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-surface focus-visible:bg-selected focus-visible:outline-none"
                  >
                    <Avatar nombre={nombreCompleto(c)} tono="suave" tamano="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{nombreCompleto(c)}</span>
                      <span className="block truncate text-label text-muted">
                        {[c.telefono ?? c.email, plural(c.total_citas, "cita", "citas")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
