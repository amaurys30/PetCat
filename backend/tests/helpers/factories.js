import { randomUUID } from "node:crypto";
import { pool } from "../../src/config/db.js";
import { hashPassword } from "../../src/shared/utils/hash.js";
import { createSessionForUser } from "../../src/modules/sessions/session.service.js";

/**
 * Fábricas de datos para tests de integración. Insertan directo por SQL para no
 * depender de los endpoints que se están probando. Cada llamada usa datos únicos,
 * así los tests no chocan entre sí ni con el seed de desarrollo.
 */

export const PASSWORD = "Petcat123!";

let passwordHashCache;
const passwordHash = async () => (passwordHashCache ??= await hashPassword(PASSWORD));

/** Sufijo único y corto para emails y nombres. */
export const unique = () => randomUUID().slice(0, 8);

const insert = async (table, data) => {
  const columns = Object.keys(data);
  const [result] = await pool.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    Object.values(data)
  );
  return result.insertId;
};

const findOne = async (table, idColumn, id) => {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [id]);
  return rows[0];
};

/**
 * Usuario con contraseña `PASSWORD`. Devuelve la fila de `usuarios` más `password`.
 */
export const crearUsuario = async (overrides = {}) => {
  const id = await insert("usuarios", {
    nombre: "Usuario",
    apellido: "Prueba",
    email: `usuario_${unique()}@petcat.test`,
    password_hash: await passwordHash(),
    tipo_usuario: "cliente",
    ...overrides,
  });
  return { ...(await findOne("usuarios", "id_usuario", id)), password: PASSWORD };
};

export const crearAdmin = (overrides = {}) => crearUsuario({ tipo_usuario: "admin", ...overrides });

/**
 * Negocio con suscripción al plan Gratuito. Si no se pasa propietario, se crea uno.
 */
export const crearNegocio = async (propietario, overrides = {}) => {
  const owner = propietario ?? (await crearUsuario({ tipo_usuario: "negocio" }));
  const id = await insert("negocios", {
    id_usuario_propietario: owner.id_usuario,
    nombre: `Negocio ${unique()}`,
    tipo: "veterinaria",
    ...overrides,
  });
  await pool.query(
    `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin)
     VALUES (?, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Gratuito'), 'activa', CURDATE(), '9999-12-31')`,
    [id]
  );
  return { ...(await findOne("negocios", "id_negocio", id)), propietario: owner };
};

export const crearSucursal = async (negocio, overrides = {}) => {
  const id = await insert("sucursales", {
    id_negocio: negocio.id_negocio,
    nombre: `Sucursal ${unique()}`,
    direccion: "Calle 1 # 2-3",
    ...overrides,
  });
  return findOne("sucursales", "id_sucursal", id);
};

/** id_rol de un rol del sistema: "Administrador", "Veterinario" o "Recepcionista". */
export const rolDelSistema = async (nombre) => {
  const [rows] = await pool.query(
    "SELECT id_rol FROM roles WHERE nombre = ? AND es_sistema = TRUE",
    [nombre]
  );
  if (!rows[0]) throw new Error(`No existe el rol del sistema ${nombre}`);
  return rows[0].id_rol;
};

/** Rol propio de un negocio con los permisos dados, p. ej. { citas: ["ver"] }. */
export const crearRol = async (negocio, permisos = {}, overrides = {}) => {
  const id = await insert("roles", {
    id_negocio: negocio.id_negocio,
    nombre: `Rol ${unique()}`,
    permisos_json: JSON.stringify(permisos),
    ...overrides,
  });
  return findOne("roles", "id_rol", id);
};

/**
 * Empleado de un negocio.
 * - `rol`: nombre de un rol del sistema (por defecto "Veterinario") o un id_rol numérico.
 * - `usuario`: fila de usuario para vincularlo (si se omite, queda sin cuenta).
 */
export const crearEmpleado = async (negocio, { rol = "Veterinario", usuario = null, ...overrides } = {}) => {
  const id_rol = typeof rol === "number" ? rol : await rolDelSistema(rol);
  const id = await insert("empleados", {
    id_negocio: negocio.id_negocio,
    id_rol,
    id_usuario: usuario?.id_usuario ?? null,
    nombre: usuario?.nombre ?? "Empleado",
    apellido: usuario?.apellido ?? "Prueba",
    email: usuario?.email ?? `empleado_${unique()}@petcat.test`,
    fecha_vinculacion: "2026-01-01",
    ...overrides,
  });
  return findOne("empleados", "id_empleado", id);
};

/** Rangos de horario de una sucursal: [[dia_semana, "08:00", "12:00"], ...]. */
export const crearHorarios = async (sucursal, rangos) => {
  for (const [dia_semana, hora_apertura, hora_cierre] of rangos) {
    await insert("horarios_negocio", { id_sucursal: sucursal.id_sucursal, dia_semana, hora_apertura, hora_cierre });
  }
};

export const crearMascota = async (dueno, overrides = {}) => {
  const id = await insert("mascotas", {
    id_usuario: dueno.id_usuario,
    nombre: `Mascota ${unique()}`,
    especie: "perro",
    ...overrides,
  });
  return findOne("mascotas", "id_mascota", id);
};

/** Servicio del negocio en la categoría "Consulta y diagnóstico". */
export const crearServicio = async (negocio, overrides = {}) => {
  const id = await insert("servicios", {
    id_negocio: negocio.id_negocio,
    id_categoria: await categoriaServicio("Consulta y diagnóstico"),
    nombre: `Servicio ${unique()}`,
    precio_base: 50000,
    ...overrides,
  });
  return findOne("servicios", "id_servicio", id);
};

const categoriaServicio = async (nombre) => {
  const [[row]] = await pool.query("SELECT id_categoria FROM categorias_servicio WHERE nombre = ?", [nombre]);
  return row.id_categoria;
};

/**
 * Cita en un negocio. Si no se pasan, crea cliente, mascota y servicio.
 * `fecha` en formato YYYY-MM-DD (por defecto, mañana).
 */
export const crearCita = async (negocio, { cliente, mascota, servicio, ...overrides } = {}) => {
  const dueno = cliente ?? (await crearUsuario());
  const [[{ manana }]] = await pool.query("SELECT DATE_FORMAT(CURDATE() + INTERVAL 1 DAY, '%Y-%m-%d') AS manana");
  const id = await insert("citas", {
    id_negocio: negocio.id_negocio,
    id_usuario: dueno.id_usuario,
    id_mascota: (mascota ?? (await crearMascota(dueno))).id_mascota,
    id_servicio: (servicio ?? (await crearServicio(negocio))).id_servicio,
    fecha: manana,
    hora_inicio: "09:00:00",
    hora_fin: "09:30:00",
    ...overrides,
  });
  return findOne("citas", "id_cita", id);
};

export const crearResena = async (negocio, overrides = {}) => {
  const autor = await crearUsuario();
  const id = await insert("resenas", {
    id_negocio: negocio.id_negocio,
    id_usuario: autor.id_usuario,
    calificacion: 5,
    comentario: "Excelente atención",
    ...overrides,
  });
  return findOne("resenas", "id_resena", id);
};

/**
 * Crea una sesión válida para el usuario, igual que el login, y devuelve su access token.
 */
export const tokenDe = async (usuario) => {
  const { access_token } = await createSessionForUser(usuario, {
    dispositivo: "test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  });
  return access_token;
};
