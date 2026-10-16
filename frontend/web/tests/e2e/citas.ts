import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Citas propias para las pruebas de la agenda, creadas por la API de demo en Centro
 * Veterinario Salud Animal 24h (Pro: sin límite de citas; Sede Norte abre todos los días de
 * 7 a 21; sin confirmación automática: lo que reserva la app queda pendiente). No dependen de
 * las citas del seed, que vencen. Cada prueba cancela al final lo que dejó activo.
 */
export const PASSWORD = "Petcat123!";
export const PROPIETARIO_SALUD = "saludanimal@petcat.test";
const CLIENTE = "camilo@petcat.test";
const SERVICIO = "Consulta especializada";

interface Horario {
  hora_inicio: string;
  empleados: { id_empleado: number; nombre: string; apellido: string }[];
}
export interface CitaCreada {
  id_cita: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  mascota: { nombre: string };
  empleado: { id_empleado: number; nombre: string; apellido: string } | null;
}

const respuesta = async <T>(res: Awaited<ReturnType<APIRequestContext["get"]>>, url: string) => {
  expect(res.ok(), `${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
};

export async function token(request: APIRequestContext, email: string) {
  const res = await request.post("/api/v1/auth/login", { data: { email, password: PASSWORD } });
  return (await respuesta<{ access_token: string }>(res, "login")).access_token;
}

const get = async <T>(request: APIRequestContext, url: string, tk?: string) =>
  respuesta<T>(
    await request.get(`/api/v1${url}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }),
    url,
  );

/** Hoy en Bogotá más `dias`, como "YYYY-MM-DD". */
export const fechaBogota = (dias = 0) =>
  new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/** Negocio, sede y servicio de las pruebas. */
export async function contextoSalud(request: APIRequestContext) {
  const tkNegocio = await token(request, PROPIETARIO_SALUD);
  const mios = await get<{ id_negocio: number; nombre: string }[]>(request, "/negocios/mios", tkNegocio);
  const negocio = mios.find((n) => n.nombre.startsWith("Centro Veterinario Salud Animal"))!;
  const perfil = await get<{
    sucursales: { id_sucursal: number; nombre: string }[];
    servicios: { id_servicio: number; nombre: string }[];
  }>(request, `/negocios/${negocio.id_negocio}`);
  return {
    tkNegocio,
    idNegocio: negocio.id_negocio,
    idSucursal: perfil.sucursales.find((s) => s.nombre === "Sede Norte")!.id_sucursal,
    idServicio: perfil.servicios.find((s) => s.nombre === SERVICIO)!.id_servicio,
  };
}

type Contexto = Awaited<ReturnType<typeof contextoSalud>>;

/**
 * Reserva desde la app (Camilo) en el primer horario libre desde mañana; queda pendiente.
 * `conDos`: un horario en que atienden al menos dos profesionales (para reasignar).
 */
export async function reservaPendiente(request: APIRequestContext, ctx: Contexto, { conDos = false } = {}) {
  const tkCliente = await token(request, CLIENTE);
  const mascotas = await get<{ id_mascota: number; fallecido: boolean }[]>(request, "/mascotas", tkCliente);
  for (let dia = 1; dia <= 21; dia++) {
    const fecha = fechaBogota(dia);
    const libres = await get<{ horarios: Horario[] }>(
      request,
      `/citas/horarios-libres?id_servicio=${ctx.idServicio}&id_sucursal=${ctx.idSucursal}&fecha=${fecha}`,
    );
    // Los últimos del día: chocan menos con las citas del seed y de otras corridas.
    for (const h of [...libres.horarios].reverse().filter((x) => !conDos || x.empleados.length >= 2)) {
      for (const m of mascotas.filter((x) => !x.fallecido)) {
        const res = await request.post("/api/v1/citas", {
          headers: { Authorization: `Bearer ${tkCliente}` },
          data: {
            id_servicio: ctx.idServicio,
            id_sucursal: ctx.idSucursal,
            fecha,
            hora_inicio: h.hora_inicio,
            id_mascota: m.id_mascota,
          },
        });
        if (res.status() === 201) return ((await res.json()) as { data: CitaCreada }).data;
      }
    }
  }
  throw new Error("No se encontró un horario libre para la reserva de prueba");
}

/** Cita del panel para hoy en el primer horario libre (queda confirmada); null si ya no hay. */
export async function citaDeHoy(request: APIRequestContext, ctx: Contexto) {
  const tkCliente = await token(request, CLIENTE);
  const yo = await get<{ id_usuario: number }>(request, "/auth/me", tkCliente);
  const mascotas = await get<{ id_mascota: number; fallecido: boolean }[]>(request, "/mascotas", tkCliente);
  const fecha = fechaBogota();
  const libres = await get<{ horarios: Horario[] }>(
    request,
    `/negocios/${ctx.idNegocio}/citas/horarios-libres?id_servicio=${ctx.idServicio}&id_sucursal=${ctx.idSucursal}&fecha=${fecha}`,
    ctx.tkNegocio,
  );
  for (const h of libres.horarios) {
    for (const m of mascotas.filter((x) => !x.fallecido)) {
      const res = await request.post(`/api/v1/negocios/${ctx.idNegocio}/citas`, {
        headers: { Authorization: `Bearer ${ctx.tkNegocio}` },
        data: {
          id_usuario: yo.id_usuario,
          id_servicio: ctx.idServicio,
          id_sucursal: ctx.idSucursal,
          fecha,
          hora_inicio: h.hora_inicio,
          id_mascota: m.id_mascota,
          origen: "telefono",
        },
      });
      if (res.status() === 201) return ((await res.json()) as { data: CitaCreada }).data;
    }
  }
  return null;
}

export const estadoDe = async (request: APIRequestContext, ctx: Contexto, idCita: number) =>
  (await get<CitaCreada>(request, `/citas/${idCita}`, ctx.tkNegocio)).estado;

/** Limpieza: cancela la cita si quedó pendiente o confirmada. */
export async function cancelarSiActiva(request: APIRequestContext, ctx: Contexto, idCita: number) {
  if (["pendiente", "confirmada"].includes(await estadoDe(request, ctx, idCita))) {
    await request.post(`/api/v1/citas/${idCita}/cancelar`, {
      headers: { Authorization: `Bearer ${ctx.tkNegocio}` },
      data: { motivo: "Limpieza de la prueba de punta a punta" },
    });
  }
}

/** Bloqueo del profesional de la cita a esa hora: la deja fuera de su disponibilidad. Devuelve su id. */
export async function bloquearHoraDe(
  request: APIRequestContext,
  ctx: Contexto,
  cita: CitaCreada,
  motivo: string,
) {
  const res = await request.post(`/api/v1/empleados/${cita.empleado!.id_empleado}/disponibilidad`, {
    headers: { Authorization: `Bearer ${ctx.tkNegocio}` },
    data: {
      tipo: "bloqueo",
      fecha_especifica: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: cita.hora_fin,
      motivo,
    },
  });
  return (await respuesta<{ disponibilidad: { id_disponibilidad: number } }>(res, "bloqueo")).disponibilidad
    .id_disponibilidad;
}

export async function quitarBloqueo(request: APIRequestContext, ctx: Contexto, idDisponibilidad: number) {
  await request.delete(`/api/v1/disponibilidad/${idDisponibilidad}`, {
    headers: { Authorization: `Bearer ${ctx.tkNegocio}` },
  });
}
