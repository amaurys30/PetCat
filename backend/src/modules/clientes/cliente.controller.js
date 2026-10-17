import * as service from "./cliente.service.js";
import * as notaService from "./nota.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

export const buscarClientes = async (req, res) => {
  return ok(res, await service.buscarClientes(req.query));
};

export const registrarCliente = async (req, res) => {
  const data = await service.registrarCliente(req.negocio, req.body, { id_usuario: req.user.id_usuario, ip: req.ip });
  return created(
    res,
    data,
    data.sin_cuenta
      ? "Cliente registrado sin cuenta: no recibirá correos ni recordatorios y no podrá entrar a la app"
      : "Cliente registrado. Le enviamos un correo para que cree su contraseña"
  );
};

export const agregarMascota = async (req, res) => {
  const mascota = await service.agregarMascota(req.negocio.id_negocio, req.params.id_usuario, req.body);
  return created(res, mascota, "Mascota registrada");
};

export const listarClientes = async (req, res) => {
  const { rows, meta } = await service.listarClientes(req.negocio.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const getCliente = async (req, res) => {
  return ok(res, await service.getCliente(req.negocio.id_negocio, req.params.id_usuario, req.user, req.acceso));
};

// ---------- Notas del negocio sobre el cliente (2.7) ----------

export const getNotas = async (req, res) => {
  const { rows, meta } = await notaService.getNotas(req.negocio.id_negocio, req.params.id_usuario, req.query, req.user, req.acceso);
  return paginated(res, rows, meta);
};

export const crearNota = async (req, res) => {
  return created(res, await notaService.crearNota(req.negocio.id_negocio, req.params.id_usuario, req.body, req.user, req.acceso), "Nota guardada");
};

export const editarNota = async (req, res) => {
  return ok(res, await notaService.editarNota(req.params.id_nota, req.body, req.user, req.acceso), "Nota actualizada");
};

export const borrarNota = async (req, res) => {
  await notaService.borrarNota(req.params.id_nota, req.user, req.acceso);
  return ok(res, null, "Nota eliminada");
};

export const getCitasCliente = async (req, res) => {
  const { rows, meta } = await service.getCitasCliente(req.negocio.id_negocio, req.params.id_usuario, req.query);
  return paginated(res, rows, meta);
};
