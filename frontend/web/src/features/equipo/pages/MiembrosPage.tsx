import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router";
import type { Empleado } from "@/api/empleados";
import { Avatar } from "@/components/common/Avatar";
import { Chips } from "@/components/common/Chips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { Vacio } from "@/components/common/EstadoPantalla";
import { ErrorConsulta } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { aviso } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { useNegocioActivo, usePuede, useSuscripcion } from "@/features/negocios/hooks/useNegocio";
import { textoLimite } from "@/features/negocios/textos";
import { fechaHoraLarga, tiempoHasta } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { AgregarmeDialog } from "../components/AgregarmeDialog";
import { MiembroDialog } from "../components/MiembroDialog";
import { AccionesEquipo } from "../EquipoLayout";
import {
  useDesactivarEmpleado,
  useEmpleados,
  useEscalada,
  useInvitar,
  usePermisosPorRol,
  useReactivarEmpleado,
} from "../hooks/useEquipo";
import { MAX_INVITACIONES_24H } from "../textos";

type Filtro = "todos" | "activos" | "inactivos";
const LIMITE = 20;

/** D3 · Equipo: miembros, cuenta e invitación, servicios que atienden y estado. */
export function MiembrosPage() {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const q = useDeferredValue(busqueda.trim());
  const [pagina, setPagina] = useState(1);
  const filtros = {
    page: pagina,
    limit: LIMITE,
    ...(filtro !== "todos" && { activo: filtro === "activos" }),
    ...(q && { q }),
  };
  const empleados = useEmpleados(negocio.id_negocio, filtros);
  const suscripcion = useSuscripcion(negocio.id_negocio, puede("configuracion", "ver"));
  const abrirLimitePlan = useUi((s) => s.abrirLimitePlan);

  const [editando, setEditando] = useState<Empleado | "nuevo" | null>(null);
  const [agregarme, setAgregarme] = useState(false);
  const [desactivando, setDesactivando] = useState<Empleado | null>(null);

  const uso = suscripcion.data?.uso.empleados;
  const plan = suscripcion.data?.plan;
  const enLimite = uso !== undefined && uso.maximo !== -1 && uso.usadas >= uso.maximo;
  const mensajeLimite = () =>
    plan && uso
      ? `Tu plan ${plan.nombre} permite ${textoLimite(uso.maximo, "empleado activo", "empleados activos", "")} (el propietario no cuenta). Para sumar más, cambia de plan.`
      : "";

  const nuevoMiembro = () => (enLimite ? abrirLimitePlan(mensajeLimite()) : setEditando("nuevo"));
  const verAgregarme = negocio.relacion === "propietario" && negocio.id_empleado === null;

  return (
    <>
      <AccionesEquipo>
        {verAgregarme && (
          <Button variant="secondary" onClick={() => setAgregarme(true)}>
            Agregarme como profesional
          </Button>
        )}
        {puede("empleados", "crear") && (
          <Button onClick={nuevoMiembro}>
            <Plus /> Agregar miembro
          </Button>
        )}
      </AccionesEquipo>

      {plan && uso && uso.maximo !== -1 && (
        <Alert tono="info" className="mb-4 flex items-center justify-between gap-4">
          <span>
            Plan {plan.nombre}: {uso.usadas} de {textoLimite(uso.maximo, "empleado", "empleados", "")}. El
            propietario no cuenta para el límite.
            {enLimite && " Para sumar más, prueba Pro 14 días."}
          </span>
          {enLimite && (
            <Link to="../../suscripcion" className="shrink-0 font-semibold hover:underline">
              Probar Pro →
            </Link>
          )}
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            type="search"
            aria-label="Buscar miembro"
            placeholder="Buscar por nombre, correo o documento"
            className="pl-9"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <Chips<Filtro>
          etiqueta="Estado"
          valor={filtro}
          onChange={(valor) => {
            setFiltro(valor);
            setPagina(1);
          }}
          opciones={[
            { valor: "todos", texto: "Todos" },
            { valor: "activos", texto: "Activos" },
            { valor: "inactivos", texto: "Inactivos" },
          ]}
        />
      </div>

      {empleados.isError ? (
        <ErrorConsulta error={empleados.error} reintentar={() => void empleados.refetch()} />
      ) : (
        <TablaMiembros
          datos={empleados.data?.data}
          cargando={empleados.isPending}
          filtrado={Boolean(q) || filtro !== "todos"}
          enLimite={enLimite}
          mensajeLimite={mensajeLimite()}
          onEditar={setEditando}
          onDesactivar={setDesactivando}
        />
      )}

      {empleados.data && empleados.data.meta.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-body text-muted">
          <span>
            Página {empleados.data.meta.page} de {empleados.data.meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!empleados.data.meta.hasNext}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      <p className="mt-3 text-label text-muted">
        Al desactivar a un miembro se invalidan sus invitaciones y se muestran sus citas futuras para
        reasignarlas.
      </p>

      {editando && (
        <MiembroDialog empleado={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} />
      )}
      {agregarme && <AgregarmeDialog onCerrar={() => setAgregarme(false)} />}
      <DesactivarDialog empleado={desactivando} onCerrar={() => setDesactivando(null)} />
    </>
  );
}

function TablaMiembros({
  datos,
  cargando,
  filtrado,
  enLimite,
  mensajeLimite,
  onEditar,
  onDesactivar,
}: {
  datos: Empleado[] | undefined;
  cargando: boolean;
  filtrado: boolean;
  enLimite: boolean;
  mensajeLimite: string;
  onEditar: (e: Empleado) => void;
  onDesactivar: (e: Empleado) => void;
}) {
  const columnas: ColumnDef<Empleado, unknown>[] = [
    {
      id: "miembro",
      header: "Miembro",
      cell: ({ row: { original: e } }) => (
        <div className="flex items-center gap-3">
          <Avatar
            nombre={`${e.nombre} ${e.apellido}`}
            fotoUrl={e.foto_miniatura_url}
            tono="suave"
            tamano="lg"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {e.nombre} {e.apellido}
            </p>
            <p className="truncate text-label text-muted">{e.email ?? "Sin correo"}</p>
          </div>
        </div>
      ),
    },
    {
      id: "rol",
      header: "Rol",
      cell: ({ row: { original: e } }) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {e.es_propietario && <Badge tono="done">Propietario</Badge>}
          <span>{e.rol.nombre}</span>
        </span>
      ),
    },
    { id: "cuenta", header: "Cuenta", cell: ({ row: { original: e } }) => <EstadoCuenta empleado={e} /> },
    {
      id: "atiende",
      header: "Atiende",
      cell: ({ row: { original: e } }) =>
        e.servicios.length === 0 ? (
          <span className="text-subtle">—</span>
        ) : (
          <span className="line-clamp-2 text-muted">{e.servicios.map((s) => s.nombre).join(", ")}</span>
        ),
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row: { original: e } }) =>
        e.activo ? <Badge tono="primary">Activo</Badge> : <Badge tono="neutral">Inactivo</Badge>,
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row: { original: e } }) => (
        <AccionesMiembro
          empleado={e}
          enLimite={enLimite}
          mensajeLimite={mensajeLimite}
          onEditar={() => onEditar(e)}
          onDesactivar={() => onDesactivar(e)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columnas={columnas}
      datos={datos}
      cargando={cargando}
      idFila={(e) => e.id_empleado}
      vacio={
        <Vacio
          icono={Users}
          titulo={filtrado ? "Ningún miembro coincide" : "Todavía no hay miembros en el equipo"}
          descripcion={
            filtrado
              ? "Prueba con otra búsqueda o con otro estado."
              : "Agrega a tu equipo para asignarle servicios y que aparezca en la agenda."
          }
        />
      }
    />
  );
}

function EstadoCuenta({ empleado: e }: { empleado: Empleado }) {
  if (e.tiene_cuenta) return <Badge tono="primary">Vinculada</Badge>;
  if (e.invitacion?.expiracion) {
    return (
      <Tooltip texto={`Vence el ${fechaHoraLarga(e.invitacion.expiracion)}`}>
        <span>
          <Badge tono="warning">Invitación pendiente · vence en {tiempoHasta(e.invitacion.expiracion)}</Badge>
        </span>
      </Tooltip>
    );
  }
  if (!e.email) return <Badge tono="neutral">Sin correo</Badge>;
  return <Badge tono="neutral">{e.activo ? "Sin invitar" : "Sin cuenta"}</Badge>;
}

/** Botón deshabilitado con su motivo en un tooltip (o el botón normal si no hay motivo). */
function ConMotivo({ motivo, children }: { motivo: string | null; children: React.ReactElement }) {
  if (!motivo) return children;
  return (
    <Tooltip texto={motivo}>
      <span tabIndex={0}>{children}</span>
    </Tooltip>
  );
}

function AccionesMiembro({
  empleado: e,
  enLimite,
  mensajeLimite,
  onEditar,
  onDesactivar,
}: {
  empleado: Empleado;
  enLimite: boolean;
  mensajeLimite: string;
  onEditar: () => void;
  onDesactivar: () => void;
}) {
  const puede = usePuede();
  const escalada = useEscalada();
  const permisosPorRol = usePermisosPorRol();
  const invitar = useInvitar();
  const reactivar = useReactivarEmpleado();
  const abrirLimitePlan = useUi((s) => s.abrirLimitePlan);
  const nombre = `${e.nombre} ${e.apellido}`;

  const bloqueo = escalada.modificarEmpleado(e.id_empleado, permisosPorRol.get(e.rol.id_rol));

  if (!e.activo) {
    if (!puede("empleados", "editar")) return null;
    return (
      <ConMotivo motivo={bloqueo}>
        <Button
          variant="link"
          disabled={Boolean(bloqueo)}
          cargando={reactivar.isPending}
          onClick={() =>
            // El propietario registrado como empleado no ocupa cupo.
            enLimite && !e.es_propietario
              ? abrirLimitePlan(mensajeLimite)
              : reactivar.mutate(e.id_empleado, {
                  onSuccess: () => aviso.exito(`${nombre} está activo de nuevo`),
                })
          }
        >
          Reactivar
        </Button>
      </ConMotivo>
    );
  }

  const inv = e.invitacion;
  const reenvio = Boolean(inv?.expiracion);
  const enviarInvitacion = () => invitar.mutate({ idEmpleado: e.id_empleado, reenviar: reenvio });

  // En orden de importancia: la primera va como enlace y el resto en el menú "…".
  const acciones: Accion[] = [];
  if (inv && puede("empleados", "crear")) {
    acciones.push({
      texto: reenvio
        ? `Reenviar (${inv.envios_restantes_24h} de ${MAX_INVITACIONES_24H})`
        : "Enviar invitación",
      motivo:
        inv.envios_restantes_24h === 0
          ? `Ya se enviaron ${MAX_INVITACIONES_24H} correos en 24 horas.${
              inv.libre_desde ? ` Podrás volver a enviarla desde el ${fechaHoraLarga(inv.libre_desde)}.` : ""
            }`
          : null,
      cargando: invitar.isPending,
      onClick: enviarInvitacion,
    });
  }
  if (puede("configuracion", "ver") || puede("citas", "ver") || escalada.esYo(e.id_empleado)) {
    acciones.push({ texto: "Disponibilidad", enlace: `../${e.id_empleado}/disponibilidad` });
  }
  if (puede("empleados", "editar")) {
    acciones.push({ texto: "Editar", motivo: bloqueo, onClick: onEditar });
  }
  if (puede("empleados", "eliminar")) {
    acciones.push({
      texto: "Desactivar",
      motivo: escalada.desactivar(e.id_empleado) ?? bloqueo,
      peligro: true,
      onClick: onDesactivar,
    });
  }
  const [principal, ...resto] = acciones;
  if (!principal) return null;

  return (
    <div className="flex items-center gap-3">
      {principal.enlace ? (
        <Button asChild variant="link">
          <Link to={principal.enlace}>{principal.texto}</Link>
        </Button>
      ) : (
        <ConMotivo motivo={principal.motivo ?? null}>
          <Button
            variant="link"
            disabled={Boolean(principal.motivo)}
            cargando={principal.cargando}
            onClick={principal.onClick}
          >
            {principal.texto}
          </Button>
        </ConMotivo>
      )}
      {resto.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${nombre}`}>
              <MoreHorizontal className="text-muted" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {resto.map((a) =>
              a.enlace ? (
                <DropdownMenuItem key={a.texto} asChild>
                  <Link to={a.enlace}>{a.texto}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={a.texto}
                  disabled={Boolean(a.motivo)}
                  className={a.peligro ? "text-danger" : undefined}
                  onSelect={a.onClick}
                >
                  <span className="flex flex-col">
                    {a.texto}
                    {a.motivo && <span className="text-label text-muted">{a.motivo}</span>}
                  </span>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface Accion {
  texto: string;
  enlace?: string;
  motivo?: string | null;
  peligro?: boolean;
  cargando?: boolean;
  onClick?: () => void;
}

function DesactivarDialog({ empleado, onCerrar }: { empleado: Empleado | null; onCerrar: () => void }) {
  const desactivar = useDesactivarEmpleado();
  const mostrarCitasAfectadas = useUi((s) => s.mostrarCitasAfectadas);
  if (!empleado) return null;
  const nombre = `${empleado.nombre} ${empleado.apellido}`;
  return (
    <ConfirmDialog
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) {
          desactivar.reset();
          onCerrar();
        }
      }}
      titulo={`¿Desactivar a ${nombre}?`}
      descripcion="Pierde el acceso al panel y se anulan sus invitaciones pendientes. Sus citas futuras quedan sin profesional disponible: te mostraremos cuáles para reasignarlas. Podrás reactivarlo después."
      confirmar="Desactivar"
      peligro
      cargando={desactivar.isPending}
      onConfirmar={() =>
        desactivar.mutate(empleado.id_empleado, {
          onSuccess: ({ citas_afectadas }) => {
            onCerrar();
            aviso.exito(`${nombre} quedó inactivo`);
            mostrarCitasAfectadas(citas_afectadas, `${nombre} quedó inactivo`);
          },
        })
      }
    >
      {desactivar.error && <Alert tono="error">{desactivar.error.message}</Alert>}
    </ConfirmDialog>
  );
}
