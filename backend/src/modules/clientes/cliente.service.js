import { randomBytes } from "node:crypto";
import * as clienteRepo from "./cliente.repository.js";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import * as mascotaRepo from "../mascotas/mascota.repository.js";
import * as autorizacionRepo from "../autorizaciones/autorizacion.repository.js";
import { formatMascota } from "../mascotas/mascota.service.js";
import { emitirEnlaceBienvenida, enviarBienvenida, versionPolitica } from "../auth/auth.service.js";
import { hashPassword } from "../../shared/utils/hash.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import * as citaRepo from "../citas/cita.repository.js";
import { formatCitasPanel } from "../citas/cita.service.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { castFields } from "../../shared/utils/format.js";
import { getResumenNotas } from "./nota.service.js";

const MAX_CITAS_RECIENTES = 10;

/** Búsqueda exacta: hasta 5 clientes con sus mascotas activas y vivas (datos mínimos). */
export const buscarClientes = async (query) => {
  const clientes = await clienteRepo.buscar(query);
  const mascotas = await clienteRepo.findMascotasVivas(clientes.map((c) => c.id_usuario));
  return clientes.map((c) => ({ ...c, usa_app: Boolean(c.usa_app), mascotas: mascotas[c.id_usuario] ?? [] }));
};

/** Algún usuario activo con ese teléfono (solo dígitos) ya es cliente del negocio. */
const yaEsClienteConTelefono = async (id_negocio, telefono) => {
  const mismos = await clienteRepo.buscar({ telefono: telefono.replace(/\D/g, "") });
  for (const u of mismos) if (await clienteRepo.tieneRelacion(u.id_usuario, id_negocio)) return true;
  return false;
};

/**
 * Registra un cliente sin app con su primera mascota, en una transacción: el
 * usuario (contraseña aleatoria que nadie conoce), la mascota, la autorización de
 * datos (canal panel, negocio y quién la registró) y, con correo, el enlace de
 * bienvenida para crear su contraseña (el correo se envía después, sin esperar).
 * Sin correo queda sin cuenta: no hay bienvenida y, para no duplicarlo, no puede haber
 * otro cliente de este negocio con el mismo teléfono (409): en una familia es común
 * compartirlo, y a ese cliente sí se le puede agregar la mascota. Un usuario con ese teléfono
 * sin relación con el negocio no lo impide: el negocio no podría agregarle mascotas.
 * Devuelve también `sin_cuenta`.
 */
export const registrarCliente = async (negocio, { mascota, ...datos }, actor) => {
  const sinCuenta = !datos.email;
  if (!sinCuenta && (await usuarioRepo.findByEmail(datos.email))) {
    throw ApiError.conflict("Ya existe una cuenta con ese correo: búscala con clientes/buscar", {
      email: "Ya está registrado",
    });
  }
  if (sinCuenta && (await yaEsClienteConTelefono(negocio.id_negocio, datos.telefono))) {
    throw ApiError.conflict(
      "Ya hay un cliente con ese teléfono. Si es de la misma familia, búscalo por teléfono, elígelo y agrégale la mascota.",
      { telefono: "Ya hay un cliente con este teléfono" }
    );
  }
  const password_hash = await hashPassword(randomBytes(32).toString("hex"));
  const version_politica = await versionPolitica();

  const { id_usuario, id_mascota, token } = await withTransaction(async (conn) => {
    const id = await usuarioRepo.create(
      { nombre: datos.nombre, apellido: datos.apellido, email: datos.email ?? null, telefono: datos.telefono, password_hash },
      conn
    );
    const idMascota = await mascotaRepo.create(id, mascota, conn);
    await autorizacionRepo.create(
      {
        id_usuario: id,
        canal: "panel",
        id_negocio: negocio.id_negocio,
        id_usuario_registro: actor.id_usuario,
        version_politica,
        ip_address: actor.ip ?? null,
      },
      conn
    );
    return { id_usuario: id, id_mascota: idMascota, token: sinCuenta ? null : await emitirEnlaceBienvenida(id, conn) };
  });

  if (!sinCuenta) await enviarBienvenida({ token, email: datos.email, nombre: datos.nombre, negocio: negocio.nombre });
  return {
    cliente: await clienteRepo.findActivo(id_usuario),
    mascota: formatMascota(await mascotaRepo.findById(id_mascota)),
    sin_cuenta: sinCuenta,
  };
};

/**
 * Agrega una mascota a un cliente existente desde el panel. Solo si el cliente
 * tiene relación con el negocio (una cita con él o una autorización que el
 * negocio registró); si no, 403. Cliente inexistente o inactivo: 404.
 */
export const agregarMascota = async (id_negocio, id_usuario, data) => {
  if (!(await clienteRepo.findActivo(id_usuario))) throw ApiError.notFound("Cliente no encontrado");
  if (!(await clienteRepo.tieneRelacion(id_usuario, id_negocio))) {
    throw ApiError.forbidden("Este cliente no tiene relación con el negocio: solo el dueño puede registrar sus mascotas desde la app");
  }
  const id_mascota = await mascotaRepo.create(id_usuario, data);
  return formatMascota(await mascotaRepo.findById(id_mascota));
};

// ---------- Clientes del negocio (1.7) ----------

const NO_ES_CLIENTE = "Cliente no encontrado en este negocio";

/** Primera fecha de relación con el negocio: la primera cita o la autorización que registró. */
const clienteDesde = ({ primera_cita, primera_autorizacion }) => [primera_cita, primera_autorizacion].filter(Boolean).sort()[0];

/** La cuenta ya se activó: creó su contraseña (correo verificado) o entró alguna vez. */
const cuentaActivada = (cuenta) => Boolean(cuenta.email_verificado) || cuenta.ultimo_acceso !== null;

/**
 * El negocio puede poner el correo de un cliente sin correo, o corregir el de un cliente
 * que él registró y que aún no activó su cuenta.
 */
const correoEditable = (cuenta, registradoPorElNegocio) =>
  !cuentaActivada(cuenta) && (cuenta.email === null || Boolean(registradoPorElNegocio));

export const listarClientes = async (id_negocio, { page, limit, q, orden }) => {
  const { rows, total } = await clienteRepo.findPageDeNegocio(id_negocio, { q, orden, limit, offset: (page - 1) * limit });
  return {
    rows: rows.map(({ primera_cita, primera_autorizacion, ...r }) => ({
      ...r,
      total_citas: Number(r.total_citas),
      inasistencias: Number(r.inasistencias),
      usa_app: Boolean(r.usa_app),
      registrado_por_el_negocio: Boolean(r.registrado_por_el_negocio),
      cliente_desde: clienteDesde({ primera_cita, primera_autorizacion }),
    })),
    meta: buildMeta(total, page, limit),
  };
};

/**
 * Pone o corrige el correo de un cliente desde el panel y le envía la bienvenida para
 * que active su cuenta (crear su contraseña). 404 si no es cliente del negocio; 409 si ya
 * activó su cuenta (desde ahí solo él cambia su correo) o si el correo es de otra cuenta;
 * 403 si ya tiene correo y no lo registró este negocio. Con un correo distinto, el enlace
 * nuevo reemplaza al anterior, que fue a otra dirección y deja de servir. Con el mismo
 * correo es un reenvío (429 si el anterior salió hace menos de un minuto).
 */
export const asignarCorreo = async (negocio, id_usuario, { email }) => {
  const cliente = await clienteRepo.findClienteDeNegocio(id_usuario, negocio.id_negocio);
  if (!cliente) throw ApiError.notFound(NO_ES_CLIENTE);

  const { accion, token } = await withTransaction(async (conn) => {
    const cuenta = await clienteRepo.lockCuenta(id_usuario, conn);
    if (cuentaActivada(cuenta)) {
      throw ApiError.conflict("El cliente ya activó su cuenta: solo él puede cambiar su correo desde la app");
    }
    if (!correoEditable(cuenta, cliente.registrado_por_el_negocio)) {
      throw ApiError.forbidden("Solo el negocio que registró al cliente puede corregir su correo");
    }
    if (cuenta.email === email) {
      const reenvio = await emitirEnlaceBienvenida(id_usuario, conn);
      if (!reenvio) throw ApiError.tooMany("Le enviamos la bienvenida hace menos de un minuto: espera un momento para reenviarla");
      return { accion: "reenviado", token: reenvio };
    }
    if (await usuarioRepo.findByEmail(email, conn)) {
      throw ApiError.conflict("Ya existe una cuenta con ese correo", { email: "Ya está registrado" });
    }
    await clienteRepo.updateEmail(id_usuario, email, conn);
    return {
      accion: cuenta.email === null ? "agregado" : "corregido",
      token: await emitirEnlaceBienvenida(id_usuario, conn, { esperaMinutos: 0 }),
    };
  });

  await enviarBienvenida({ token, email, nombre: cliente.nombre, negocio: negocio.nombre });
  return { cliente: await clienteRepo.findActivo(id_usuario), accion };
};

/**
 * Detalle del cliente en el negocio. 404 si no es cliente de este negocio (no se
 * revela si la cuenta existe). Todo (citas, cumplimiento, conteos) es solo de este negocio.
 */
export const getCliente = async (id_negocio, id_usuario, usuario, acceso) => {
  const cliente = await clienteRepo.findClienteDeNegocio(id_usuario, id_negocio);
  if (!cliente) throw ApiError.notFound(NO_ES_CLIENTE);

  const [historial_cumplimiento, mascotas, proximas, recientes, notas] = await Promise.all([
    citaRepo.resumenCumplimiento(id_usuario, id_negocio),
    clienteRepo.findMascotasDeCliente(id_usuario, id_negocio),
    citaRepo.findPageDeUsuario(id_usuario, { id_negocio, alcance: "proximas", estados: ["pendiente", "confirmada"], limit: 50, offset: 0 }),
    citaRepo.findPageDeUsuario(id_usuario, { id_negocio, alcance: "pasadas", limit: MAX_CITAS_RECIENTES, offset: 0 }),
    getResumenNotas(id_negocio, id_usuario, usuario, acceso),
  ]);

  return {
    cliente: {
      id_usuario: cliente.id_usuario,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      telefono: cliente.telefono,
      cliente_desde: clienteDesde(cliente),
      registrado_por_el_negocio: Boolean(cliente.registrado_por_el_negocio),
      usa_app: cliente.ultimo_acceso !== null,
      correo_editable: correoEditable(cliente, cliente.registrado_por_el_negocio),
    },
    historial_cumplimiento,
    mascotas: mascotas.map((m) =>
      castFields(m, { bools: ["tiene_alergias", "fallecido", "acceso_historial"], numbers: ["peso", "edad_meses", "citas_con_negocio"] })
    ),
    citas: {
      proximas: await formatCitasPanel(proximas.rows, id_negocio),
      recientes: await formatCitasPanel(recientes.rows, id_negocio),
    },
    // Solo de este negocio (2.7).
    ...notas,
  };
};

/** Todas las citas del cliente con el negocio (paginadas, de la más reciente hacia atrás). */
export const getCitasCliente = async (id_negocio, id_usuario, { page, limit, estado }) => {
  if (!(await clienteRepo.findClienteDeNegocio(id_usuario, id_negocio))) throw ApiError.notFound(NO_ES_CLIENTE);
  const { rows, total } = await citaRepo.findPageDeUsuario(id_usuario, {
    id_negocio,
    alcance: "todas",
    estados: estado,
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: await formatCitasPanel(rows, id_negocio), meta: buildMeta(total, page, limit) };
};
