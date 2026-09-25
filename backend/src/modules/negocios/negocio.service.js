// negocio.service.js
import * as negocioRepo from "./negocio.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";

export const createNegocio = async (data) => {
  // Validación básica
  if (!data.nombre || !data.tipo) {
    throw new Error("Nombre y tipo son obligatorios");
  }

  return await negocioRepo.createNegocio(data);
};

export const getNegociosByUsuario = async (id_usuario) => {
  return await negocioRepo.findByUsuario(id_usuario);
};


export const getNegocioPublico = async (id_negocio) => {
  return await negocioRepo.getNegocioPublicoCompleto(id_negocio);
};


export const updateNegocio = async (id_negocio, id_usuario, data) => {

  // 1️⃣ Verificar existencia
  const negocio = await negocioRepo.findById(id_negocio);

  if (!negocio) {
    const err = new Error("Negocio no encontrado");
    err.status = 404;
    throw err;
  }

  // 2️⃣ Verificar propietario
  if (negocio.id_usuario_propietario !== id_usuario) {
    const err = new Error("No tienes permisos para editar este negocio");
    err.status = 403;
    throw err;
  }

  // 3️⃣ Campos permitidos (whitelist)
  const allowedFields = [
    "nombre",
    "tipo",
    "descripcion",
    "telefono",
    "whatsapp",
    "email",
    "sitio_web",
    "direccion",
    "ciudad",
    "departamento",
    "pais",
    "codigo_postal",
    "latitud",
    "longitud",
    "logo_url",
    "banner_url"
  ];

  const filteredData = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  }

  if (Object.keys(filteredData).length === 0) {
    const err = new Error("No hay campos válidos para actualizar");
    err.status = 400;
    throw err;
  }

  // 4️⃣ Validaciones básicas
  if (filteredData.email && !filteredData.email.includes("@")) {
    throw new Error("Email inválido");
  }

  if (filteredData.tipo) {
    const tiposValidos = [
      "veterinaria",
      "tienda_mascotas",
      "peluqueria_canina",
      "guarderia",
      "entrenador",
      "clinica",
      "multiservicio"
    ];

    if (!tiposValidos.includes(filteredData.tipo)) {
      throw new Error("Tipo de negocio inválido");
    }
  }

  // 5️⃣ Update
  await negocioRepo.updateNegocio(id_negocio, filteredData);

  // 6️⃣ Retornar actualizado
  return await negocioRepo.findById(id_negocio);
};
