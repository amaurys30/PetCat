import { Users } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { SinPermiso, Vacio } from "@/components/common/EstadoPantalla";
import { Card } from "@/components/ui/card";
import { usePuede } from "@/features/negocios/hooks/useNegocio";
import { DetalleCliente } from "../components/DetalleCliente";
import { ListaClientes } from "../components/ListaClientes";
import { RegistrarClienteDialog } from "../components/RegistrarClienteDialog";

/**
 * C1 · Clientes: lista a la izquierda y detalle del cliente elegido (`?cliente=`) a la
 * derecha, así un enlace (la búsqueda del Topbar) abre el mismo cliente.
 */
export function ClientesPage() {
  const puede = usePuede();
  const [params, setParams] = useSearchParams();
  const idCliente = Number(params.get("cliente")) || null;
  const [busqueda, setBusqueda] = useState("");
  const [registrando, setRegistrando] = useState(false);

  if (!puede("clientes", "ver")) {
    return (
      <Card>
        <SinPermiso />
      </Card>
    );
  }

  const elegir = (idUsuario: number, { reemplazar = false } = {}) =>
    setParams(
      (p) => {
        p.set("cliente", String(idUsuario));
        return p;
      },
      { replace: reemplazar },
    );

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] items-start gap-5">
      <ListaClientes
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        idElegido={idCliente}
        onElegir={elegir}
        onSinResultados={() =>
          setParams(
            (p) => {
              p.delete("cliente");
              return p;
            },
            { replace: true },
          )
        }
        onNuevo={puede("citas", "crear") ? () => setRegistrando(true) : undefined}
      />
      {idCliente ? (
        <DetalleCliente key={idCliente} idUsuario={idCliente} />
      ) : (
        <Card>
          <Vacio
            icono={Users}
            titulo="Elige un cliente"
            descripcion="Su detalle, mascotas y notas aparecen aquí."
          />
        </Card>
      )}
      {registrando && (
        <RegistrarClienteDialog
          onCerrar={() => setRegistrando(false)}
          onRegistrado={({ cliente }) => {
            setRegistrando(false);
            setBusqueda("");
            elegir(cliente.id_usuario);
          }}
          onBuscar={(valor) => {
            setRegistrando(false);
            setBusqueda(valor);
          }}
        />
      )}
    </div>
  );
}
