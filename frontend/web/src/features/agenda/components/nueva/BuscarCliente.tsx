import { Check, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/common/Avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNegocioActivo } from "@/features/negocios/hooks/useNegocio";
import { useBuscarCliente, useBuscarClientePorNombre } from "@/features/clientes/hooks/useClientes";
import { cn } from "@/lib/utils";
import { contactoDe, esTelefono, type ClienteElegido } from "../../nuevaCita";
import { nombreCompleto } from "../../textos";

/**
 * Buscar al cliente en B5: teléfono o correo exactos (la API los compara así y tiene un
 * límite estricto de solicitudes, por eso se busca al confirmar) y, con clientes.ver,
 * también por nombre entre los clientes del negocio. Sin resultados ofrece registrarlo.
 */
export function BuscarCliente({
  puedeNombre,
  elegido,
  onElegir,
  onRegistrar,
}: {
  puedeNombre: boolean;
  elegido: ClienteElegido | null;
  onElegir: (cliente: ClienteElegido | null) => void;
  onRegistrar: (inicial: { email?: string; telefono?: string }) => void;
}) {
  const negocio = useNegocioActivo();
  const exacta = useBuscarCliente(negocio.id_negocio);
  const porNombre = useBuscarClientePorNombre(negocio.id_negocio);
  const [texto, setTexto] = useState("");
  const [buscado, setBuscado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ClienteElegido[] | null>(null);

  const buscar = () => {
    const t = texto.trim();
    setAviso(null);
    const listo = (lista: ClienteElegido[]) => {
      setResultados(lista);
      setBuscado(t);
    };
    const fallo = (e: { message: string }) => setAviso(e.message);
    if (t.includes("@")) exacta.mutate({ email: t }, { onSuccess: listo, onError: fallo });
    else if (esTelefono(t)) exacta.mutate({ telefono: t }, { onSuccess: listo, onError: fallo });
    else if (puedeNombre && t.length >= 2)
      porNombre.mutate(t, {
        onSuccess: (filas) =>
          listo(
            filas.map((f) => ({
              id_usuario: f.id_usuario,
              nombre: f.nombre,
              apellido: f.apellido,
              email: f.email,
              telefono: f.telefono,
              detalle: `${f.total_citas} ${f.total_citas === 1 ? "cita" : "citas"}`,
            })),
          ),
        onError: fallo,
      });
    else
      setAviso(
        puedeNombre
          ? "Escribe el teléfono, el correo o el nombre."
          : "Escribe el teléfono o el correo completos.",
      );
  };

  if (elegido) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-primary bg-selected p-3">
        <Avatar nombre={nombreCompleto(elegido)} tono="suave" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{nombreCompleto(elegido)}</span>
          <span className="block truncate text-label text-muted">{contactoDe(elegido)}</span>
        </span>
        <Check className="size-4 text-primary" aria-hidden />
        <Button variant="link" size="sm" onClick={() => onElegir(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  const exactaHecha = buscado !== null && (buscado.includes("@") || esTelefono(buscado));
  return (
    <div className="flex flex-col gap-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            aria-label="Buscar cliente"
            placeholder={puedeNombre ? "Teléfono, correo o nombre" : "Teléfono o correo"}
            className="pl-9"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" cargando={exacta.isPending || porNombre.isPending}>
          Buscar
        </Button>
      </form>
      {aviso && <Alert tono="advertencia">{aviso}</Alert>}

      {resultados && resultados.length > 0 && (
        <ul aria-label="Clientes encontrados" className="flex flex-col gap-1.5">
          {resultados.map((c) => (
            <li key={c.id_usuario}>
              <button
                type="button"
                onClick={() => onElegir(c)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-control border p-2.5 text-left hover:bg-surface",
                )}
              >
                <Avatar nombre={nombreCompleto(c)} tono="suave" tamano="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{nombreCompleto(c)}</span>
                  <span className="block truncate text-label text-muted">{contactoDe(c)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {resultados && resultados.length === 0 && (
        <p className="text-body text-muted">
          {exactaHecha
            ? "Nadie tiene ese teléfono o correo en PetCat."
            : "Ningún cliente del negocio coincide."}
        </p>
      )}
      <Button
        variant="link"
        size="sm"
        className="self-start"
        onClick={() =>
          onRegistrar(
            buscado?.includes("@")
              ? { email: buscado }
              : buscado && esTelefono(buscado)
                ? { telefono: buscado }
                : {},
          )
        }
      >
        <UserPlus /> Registrar cliente sin app
      </Button>
    </div>
  );
}
