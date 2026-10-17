import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, Mail, Phone, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { CitaPanel } from "@/api/citas";
import type { ClienteDetalle } from "@/api/clientes";
import { Avatar } from "@/components/common/Avatar";
import { QueryState } from "@/components/common/QueryState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aviso } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import type { InicioNuevaCita } from "@/features/agenda/components/nueva/NuevaCitaDialog";
import { nombreCompleto } from "@/features/agenda/textos";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { parseFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAsignarCorreo, useClienteDetalle } from "../hooks/useClientes";
import { diaYHora, lineaMascota, TEXTO_CORREO, TEXTO_SIN_CUENTA } from "../textos";
import { AgregarMascotaDialog } from "./AgregarMascotaDialog";
import { CitasClienteDialog } from "./CitasClienteDialog";
import { CorreoClienteDialog } from "./CorreoClienteDialog";
import { NotasCliente } from "./NotasCliente";
import { TablaCitas } from "./TablaCitas";
type Mascota = ClienteDetalle["mascotas"][number];

/** C1 · Detalle del cliente: contacto, cumplimiento, mascotas, notas privadas y citas, todo con este negocio. */
export function DetalleCliente({ idUsuario }: { idUsuario: number }) {
  const negocio = useNegocioActivo();
  const detalle = useClienteDetalle(negocio.id_negocio, idUsuario);
  return (
    <QueryState
      query={detalle}
      cargando={
        <div className="flex flex-col gap-4" aria-label="Cargando cliente">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
      }
    >
      {(d) => <Contenido detalle={d} />}
    </QueryState>
  );
}

function Contenido({ detalle }: { detalle: ClienteDetalle }) {
  const { cliente, historial_cumplimiento: h, citas } = detalle;
  const proxima = citas.proximas[0];
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <Cabecera detalle={detalle} />
        <div className="mt-4 grid grid-cols-4 gap-3" aria-label="Cumplimiento con este negocio">
          <Tarjeta valor={String(h.completadas)} texto="Completadas" tono="text-primary" />
          <Tarjeta
            valor={String(h.inasistencias)}
            texto="Inasistencias"
            tono={h.inasistencias > 0 ? "text-danger" : "text-ink"}
          />
          <Tarjeta
            valor={String(h.cancelaciones_tardias)}
            texto="Cancelaciones tardías"
            tono={h.cancelaciones_tardias > 0 ? "text-warning-ink" : "text-ink"}
          />
          <Tarjeta
            valor={proxima ? diaYHora(proxima) : "—"}
            texto={proxima ? "Próxima cita" : "Sin cita próxima"}
          />
        </div>
      </Card>
      <div className="grid grid-cols-2 items-start gap-4">
        <Mascotas detalle={detalle} />
        <NotasCliente
          idUsuario={cliente.id_usuario}
          recientes={detalle.notas_recientes}
          total={detalle.total_notas}
        />
      </div>
      <Citas detalle={detalle} />
    </div>
  );
}

function Tarjeta({ valor, texto, tono = "text-ink" }: { valor: string; texto: string; tono?: string }) {
  return (
    <div className="rounded-card bg-surface px-4 py-3">
      <p className={cn("text-title font-bold", tono)}>{valor}</p>
      <p className="text-label text-muted">{texto}</p>
    </div>
  );
}

function Cabecera({ detalle }: { detalle: ClienteDetalle }) {
  const { cliente, mascotas } = detalle;
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState(false);
  const reenviar = useAsignarCorreo(negocio.id_negocio, cliente.id_usuario, { avisarError: true });
  const nombre = nombreCompleto(cliente);
  const desde = format(parseFecha(cliente.cliente_desde), "MMM yyyy", { locale: es }).replace(".", "");
  const puedeAgendar = puede("citas", "crear") && puede("citas", "ver");
  const puedeCorreo = cliente.correo_editable && (puede("citas", "crear") || puede("clientes", "editar"));
  const vivas = mascotas.filter((m) => !m.fallecido);

  const agendar = () => {
    const nuevaCita: InicioNuevaCita = {
      cliente: {
        id_usuario: cliente.id_usuario,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        telefono: cliente.telefono,
        usa_app: cliente.usa_app,
        mascotas: vivas.map((m) => ({ id_mascota: m.id_mascota, nombre: m.nombre, especie: m.especie })),
      },
      idMascota: vivas.length === 1 ? vivas[0]!.id_mascota : undefined,
    };
    void navigate(`/n/${negocio.id_negocio}/agenda`, { state: { nuevaCita } });
  };

  return (
    <div>
      <div className="flex items-start gap-4">
        <Avatar nombre={nombre} tono="suave" tamano="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-bold text-ink">{nombre}</h2>
          <p className="truncate text-body text-muted">
            {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {cliente.email === null ? (
              <Tooltip texto={TEXTO_SIN_CUENTA}>
                <span>
                  <Badge>Sin cuenta</Badge>
                </span>
              </Tooltip>
            ) : (
              <Badge tono="info">{cliente.usa_app ? "Usa la app" : "Sin app"}</Badge>
            )}
            <Badge>Cliente desde {desde}</Badge>
            {cliente.registrado_por_el_negocio && <Badge>Registrado aquí</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {puedeAgendar &&
            (vivas.length > 0 ? (
              <Button onClick={agendar}>
                <CalendarPlus /> Agendar cita
              </Button>
            ) : (
              <Tooltip texto="No tiene mascotas activas: agrégale una primero">
                <span>
                  <Button disabled>
                    <CalendarPlus /> Agendar cita
                  </Button>
                </span>
              </Tooltip>
            ))}
          {cliente.telefono && (
            <Button variant="secondary" asChild>
              <a href={`tel:${cliente.telefono.replace(/[^\d+]/g, "")}`}>
                <Phone /> Llamar
              </a>
            </Button>
          )}
        </div>
      </div>

      {puedeCorreo && cliente.email === null && (
        <Alert tono="advertencia" className="mt-4 flex items-center gap-3">
          <span className="flex-1">
            <strong>Cliente sin cuenta.</strong> No recibe correos ni recordatorios y no puede entrar a la
            app. Agrégale un correo y le enviaremos la bienvenida para que active su cuenta.
          </span>
          <Button size="sm" variant="secondary" onClick={() => setCorreo(true)}>
            <Mail /> Agregar correo
          </Button>
        </Alert>
      )}
      {puedeCorreo && cliente.email !== null && (
        <Alert tono="info" className="mt-4 flex items-center gap-3">
          <span className="flex-1">
            Aún no activa su cuenta: le enviamos la bienvenida a {cliente.email}. Si el correo está mal,
            corrígelo; el enlace anterior dejará de servir.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setCorreo(true)}>
            Corregir correo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={reenviar.isPending}
            onClick={() =>
              reenviar.mutate(cliente.email!, { onSuccess: (r) => aviso.exito(TEXTO_CORREO[r.accion]) })
            }
          >
            Reenviar bienvenida
          </Button>
        </Alert>
      )}

      {correo && (
        <CorreoClienteDialog
          idUsuario={cliente.id_usuario}
          nombre={cliente.nombre}
          correoActual={cliente.email}
          onCerrar={() => setCorreo(false)}
          onGuardado={(r) => {
            setCorreo(false);
            aviso.exito(TEXTO_CORREO[r.accion]);
          }}
        />
      )}
    </div>
  );
}

function Mascotas({ detalle }: { detalle: ClienteDetalle }) {
  const puedeAgregar = usePuede()("citas", "crear");
  const [agregando, setAgregando] = useState(false);
  const { cliente, mascotas } = detalle;
  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Mascotas" role="region">
      <div className="flex items-center justify-between">
        <h3 className="text-card font-semibold text-ink">Mascotas</h3>
        {puedeAgregar && (
          <Button variant="link" size="sm" onClick={() => setAgregando(true)}>
            <Plus /> Mascota
          </Button>
        )}
      </div>
      {mascotas.length === 0 ? (
        <p className="text-body text-subtle">No tiene mascotas activas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mascotas.map((m) => (
            <li key={m.id_mascota}>
              <FilaMascota mascota={m} />
            </li>
          ))}
        </ul>
      )}
      {agregando && (
        <AgregarMascotaDialog
          idUsuario={cliente.id_usuario}
          nombreCliente={nombreCompleto(cliente)}
          onCerrar={() => setAgregando(false)}
          onAgregada={(m) => {
            setAgregando(false);
            aviso.exito(`${m.nombre} quedó registrada a nombre de ${cliente.nombre}`);
          }}
        />
      )}
    </Card>
  );
}

function FilaMascota({ mascota: m }: { mascota: Mascota }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-card border p-3", m.fallecido && "opacity-60")}>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-done-soft text-card font-bold text-done"
        aria-hidden
      >
        {m.nombre.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{m.nombre}</p>
        <p className="truncate text-label text-muted">{lineaMascota(m)}</p>
      </div>
      {m.tiene_alergias && (
        <Badge tono="danger">
          <TriangleAlert className="size-3" aria-hidden /> Alergia: {m.alergias_detalle ?? "sin detalle"}
        </Badge>
      )}
      {m.fallecido && <Badge>Fallecido</Badge>}
      <Tooltip
        texto={
          m.acceso_historial
            ? "La ficha médica llega en P5.2"
            : "Sin una cita válida con tu negocio no puedes ver su historial"
        }
      >
        <span className="text-label font-semibold text-subtle">Ficha →</span>
      </Tooltip>
    </div>
  );
}

function Citas({ detalle }: { detalle: ClienteDetalle }) {
  const negocio = useNegocioActivo();
  const puedeVerAgenda = usePuede()("citas", "ver");
  const navigate = useNavigate();
  const [todas, setTodas] = useState(false);
  // Las próximas de la más cercana a la más lejana, encima de las recientes.
  const filas = [...[...detalle.citas.proximas].reverse(), ...detalle.citas.recientes];
  const abrir = puedeVerAgenda
    ? (c: CitaPanel) => void navigate(`/n/${negocio.id_negocio}/agenda?fecha=${c.fecha}&cita=${c.id_cita}`)
    : undefined;
  return (
    <Card className="p-4" aria-label="Citas con tu negocio" role="region">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-card font-semibold text-ink">Citas con tu negocio</h3>
        {filas.length > 0 && (
          <Button variant="link" size="sm" onClick={() => setTodas(true)}>
            Ver todas →
          </Button>
        )}
      </div>
      {filas.length === 0 ? (
        <p className="text-body text-subtle">Aún no tiene citas con tu negocio.</p>
      ) : (
        <TablaCitas citas={filas} onAbrir={abrir} />
      )}
      {todas && (
        <CitasClienteDialog
          idUsuario={detalle.cliente.id_usuario}
          nombre={nombreCompleto(detalle.cliente)}
          onAbrir={abrir}
          onCerrar={() => setTodas(false)}
        />
      )}
    </Card>
  );
}
