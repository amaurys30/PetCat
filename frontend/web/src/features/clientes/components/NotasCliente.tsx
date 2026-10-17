import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { NotaCliente } from "@/api/clientes";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { aviso } from "@/components/ui/toaster";
import { nombreCompleto } from "@/features/agenda/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { fechaHora } from "@/lib/format";
import { useBorrarNota, useCrearNota, useEditarNota, useNotasCliente } from "../hooks/useClientes";
import { TEXTO_LEY_1581 } from "../textos";

const MAX_NOTA = 1000;

/**
 * Notas privadas del negocio sobre el cliente (nunca las ve el cliente ni otro negocio).
 * Muestra las 3 recientes del detalle y, con "Ver todas", la lista paginada. Solo el autor
 * edita; el autor o el propietario borran (borrado definitivo).
 */
export function NotasCliente({
  idUsuario,
  recientes,
  total,
}: {
  idUsuario: number;
  recientes: NotaCliente[];
  total: number;
}) {
  const negocio = useNegocioActivo();
  const puedeEscribir = usePuede()("clientes", "editar");
  const [todas, setTodas] = useState(false);
  const paginas = useNotasCliente(negocio.id_negocio, idUsuario, todas);
  const crear = useCrearNota(negocio.id_negocio, idUsuario);
  const [texto, setTexto] = useState("");
  const notas = todas && paginas.data ? paginas.data.pages.flatMap((p) => p.data) : recientes;

  const guardar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    crear.mutate(limpio, { onSuccess: () => setTexto("") });
  };

  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Notas del negocio" role="region">
      <div className="flex items-center justify-between">
        <h3 className="text-card font-semibold text-ink">Notas del negocio</h3>
        <Badge>Privadas</Badge>
      </div>
      {puedeEscribir && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          className="flex flex-col gap-2"
        >
          <Textarea
            aria-label="Nueva nota"
            placeholder="Escribe una nota…"
            value={texto}
            maxLength={MAX_NOTA}
            rows={2}
            onChange={(e) => setTexto(e.target.value)}
          />
          {texto.trim() !== "" && (
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-label text-subtle">
                {texto.length}/{MAX_NOTA}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setTexto("")}>
                Descartar
              </Button>
              <Button type="submit" size="sm" disabled={crear.isPending}>
                Guardar nota
              </Button>
            </div>
          )}
        </form>
      )}
      {notas.length === 0 ? (
        <p className="text-body text-subtle">Aún no hay notas sobre este cliente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notas.map((n) => (
            <li key={n.id_nota}>
              <Nota nota={n} />
            </li>
          ))}
        </ul>
      )}
      {!todas && total > recientes.length && (
        <Button variant="link" size="sm" className="self-start" onClick={() => setTodas(true)}>
          Ver todas ({total})
        </Button>
      )}
      {todas && paginas.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void paginas.fetchNextPage()}
          disabled={paginas.isFetchingNextPage}
        >
          Cargar más
        </Button>
      )}
      <p className="text-label text-muted">{TEXTO_LEY_1581}</p>
    </Card>
  );
}

function Nota({ nota }: { nota: NotaCliente }) {
  const negocio = useNegocioActivo();
  const puedeEscribir = usePuede()("clientes", "editar");
  const editar = useEditarNota(negocio.id_negocio);
  const borrar = useBorrarNota(negocio.id_negocio);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const autor = nota.autor ? nombreCompleto(nota.autor) : "Ex miembro del equipo";

  if (editando !== null) {
    const limpio = editando.trim();
    return (
      <form
        className="flex flex-col gap-2 rounded-control bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!limpio) return;
          editar.mutate({ idNota: nota.id_nota, texto: limpio }, { onSuccess: () => setEditando(null) });
        }}
      >
        <Textarea
          aria-label="Editar nota"
          value={editando}
          maxLength={MAX_NOTA}
          rows={3}
          autoFocus
          onChange={(e) => setEditando(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditando(null);
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(null)}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!limpio || limpio === nota.texto || editar.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group rounded-control bg-surface p-3">
      <p className="text-body whitespace-pre-line text-ink">{nota.texto}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-label text-muted">
          {autor} · {fechaHora(nota.fecha_creacion)}
          {nota.fecha_edicion && " · editada"}
        </p>
        {puedeEscribir && (
          <span className="ml-auto flex gap-1">
            {nota.editable && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Editar nota"
                onClick={() => setEditando(nota.texto)}
              >
                <Pencil />
              </Button>
            )}
            {nota.eliminable && (
              <Button variant="ghost" size="sm" aria-label="Borrar nota" onClick={() => setBorrando(true)}>
                <Trash2 />
              </Button>
            )}
          </span>
        )}
      </div>
      <ConfirmDialog
        abierto={borrando}
        onAbiertoChange={setBorrando}
        titulo="¿Borrar esta nota?"
        descripcion="Se elimina definitivamente: no queda copia ni se puede recuperar."
        confirmar="Borrar nota"
        peligro
        cargando={borrar.isPending}
        onConfirmar={() =>
          borrar.mutate(nota.id_nota, {
            onSuccess: () => {
              setBorrando(false);
              aviso.exito("Nota eliminada");
            },
          })
        }
      />
    </div>
  );
}
