import * as service from "./cliente.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const buscarClientes = async (req, res) => {
  return ok(res, await service.buscarClientes(req.query));
};

export const registrarCliente = async (req, res) => {
  const data = await service.registrarCliente(req.negocio, req.body, { id_usuario: req.user.id_usuario, ip: req.ip });
  return created(res, data, "Cliente registrado. Le enviamos un correo para que cree su contraseña");
};

export const agregarMascota = async (req, res) => {
  const mascota = await service.agregarMascota(req.negocio.id_negocio, req.params.id_usuario, req.body);
  return created(res, mascota, "Mascota registrada");
};
