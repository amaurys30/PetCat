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

/** Búsqueda exacta: hasta 5 clientes con sus mascotas activas y vivas (datos mínimos). */
export const buscarClientes = async (query) => {
  const clientes = await clienteRepo.buscar(query);
  const mascotas = await clienteRepo.findMascotasVivas(clientes.map((c) => c.id_usuario));
  return clientes.map((c) => ({ ...c, mascotas: mascotas[c.id_usuario] ?? [] }));
};

/**
 * Registra un cliente sin app con su primera mascota, en una transacción: el
 * usuario (contraseña aleatoria que nadie conoce), la mascota, la autorización de
 * datos (canal panel, negocio y quién la registró) y el enlace de bienvenida para
 * crear su contraseña. El correo se envía después, sin esperar.
 */
export const registrarCliente = async (negocio, { mascota, ...datos }, actor) => {
  if (await usuarioRepo.findByEmail(datos.email)) {
    throw ApiError.conflict("Ya existe una cuenta con ese correo: búscala con clientes/buscar", {
      email: "Ya está registrado",
    });
  }
  const password_hash = await hashPassword(randomBytes(32).toString("hex"));
  const version_politica = await versionPolitica();

  const { id_usuario, id_mascota, token } = await withTransaction(async (conn) => {
    const id = await usuarioRepo.create(
      { nombre: datos.nombre, apellido: datos.apellido, email: datos.email, telefono: datos.telefono, password_hash },
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
    return { id_usuario: id, id_mascota: idMascota, token: await emitirEnlaceBienvenida(id, conn) };
  });

  await enviarBienvenida({ token, email: datos.email, nombre: datos.nombre, negocio: negocio.nombre });
  return {
    cliente: await clienteRepo.findActivo(id_usuario),
    mascota: formatMascota(await mascotaRepo.findById(id_mascota)),
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
