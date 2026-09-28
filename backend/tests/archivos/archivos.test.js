import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { pool } from "../../src/config/db.js";
import { storage, almacenamientoSinConfigurar, conMiniaturas } from "../../src/shared/utils/storage.js";
import { procesarArchivo } from "../../src/shared/utils/uploads.js";
import {
  eliminarArchivos,
  formatArchivoPrivado,
  reintentarEliminaciones,
  subirArchivos,
} from "../../src/modules/archivos/archivo.service.js";
import { crearMascota, crearUsuario } from "../helpers/factories.js";

afterEach(() => storage.reiniciar());

const imagen = async (color = "#3a6") =>
  procesarArchivo(
    { buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background: color } }).png().toBuffer(), originalname: "max.png" },
    "mascota_foto"
  );

const filasDe = async (id_mascota) => {
  const [rows] = await pool.query(
    "SELECT id_archivo, public_id, estado, intentos_eliminar FROM archivos WHERE entidad = 'mascota_foto' AND id_entidad = ? ORDER BY id_archivo",
    [id_mascota]
  );
  return rows;
};

/** Foto de mascota como la subirá la 2.2: bloquea la mascota y guarda la URL en foto_url. */
const subirFoto = async (mascota, dueno, procesado, extra = {}) =>
  subirArchivos({
    entidad: "mascota_foto",
    id_entidad: mascota.id_mascota,
    procesados: [procesado],
    id_usuario: dueno.id_usuario,
    reemplazar: true,
    bloquear: (conn) => conn.query("SELECT id_mascota FROM mascotas WHERE id_mascota = ? FOR UPDATE", [mascota.id_mascota]),
    actualizar: (conn, [archivo]) =>
      conn.query("UPDATE mascotas SET foto_url = ? WHERE id_mascota = ?", [archivo.url, mascota.id_mascota]),
    ...extra,
  });

const contexto = async () => {
  const dueno = await crearUsuario();
  return { dueno, mascota: await crearMascota(dueno) };
};

describe("subirArchivos", () => {
  it("sube, registra y actualiza el registro en la misma operación", async () => {
    const { dueno, mascota } = await contexto();
    const [archivo] = await subirFoto(mascota, dueno, await imagen());

    expect(archivo).toMatchObject({ entidad: "mascota_foto", id_entidad: mascota.id_mascota, entrega: "upload", formato: "webp", estado: "activo" });
    expect(archivo.public_id).toMatch(new RegExp(`^petcat-test/mascotas/${mascota.id_mascota}/[0-9a-f]{24}$`));
    expect(storage.archivos.get(archivo.public_id)).toMatchObject({ entrega: "upload", formato: "webp" });
    const [[{ foto_url }]] = await pool.query("SELECT foto_url FROM mascotas WHERE id_mascota = ?", [mascota.id_mascota]);
    expect(foto_url).toBe(archivo.url);
    expect(conMiniaturas({ foto_url })).toEqual({
      foto_url,
      foto_miniatura_url: `https://almacenamiento.test/miniatura/${archivo.public_id}`,
    });
  });

  it("al reemplazar, la anterior se borra del almacenamiento y queda eliminada", async () => {
    const { dueno, mascota } = await contexto();
    const [primera] = await subirFoto(mascota, dueno, await imagen());
    const [segunda] = await subirFoto(mascota, dueno, await imagen("#a36"));

    expect(storage.archivos.has(primera.public_id)).toBe(false);
    expect(storage.archivos.has(segunda.public_id)).toBe(true);
    expect((await filasDe(mascota.id_mascota)).map((f) => f.estado)).toEqual(["eliminado", "activo"]);
  });

  it("si el borrado falla, la anterior queda por_eliminar y el reintento la borra", async () => {
    const { dueno, mascota } = await contexto();
    const [primera] = await subirFoto(mascota, dueno, await imagen());
    storage.fallarAlEliminar = true;
    await subirFoto(mascota, dueno, await imagen("#a36"));
    expect((await filasDe(mascota.id_mascota))[0]).toMatchObject({ estado: "por_eliminar", intentos_eliminar: 1 });
    expect(storage.archivos.has(primera.public_id)).toBe(true);

    storage.fallarAlEliminar = false;
    expect(await reintentarEliminaciones()).toBeGreaterThanOrEqual(1);
    expect((await filasDe(mascota.id_mascota))[0].estado).toBe("eliminado");
    expect(storage.archivos.has(primera.public_id)).toBe(false);
  });

  it("dos reintentos a la vez (dos instancias) dejan el archivo eliminado sin errores", async () => {
    const { dueno, mascota } = await contexto();
    const [primera] = await subirFoto(mascota, dueno, await imagen());
    storage.fallarAlEliminar = true;
    await subirFoto(mascota, dueno, await imagen("#a36"));
    storage.fallarAlEliminar = false;

    await Promise.all([reintentarEliminaciones(), reintentarEliminaciones()]);
    expect((await filasDe(mascota.id_mascota))[0]).toMatchObject({ estado: "eliminado", intentos_eliminar: 1 });
    expect(storage.archivos.has(primera.public_id)).toBe(false);
  });

  it("al agotar los reintentos queda por_eliminar, se avisa en el log y ya no se reintenta", async () => {
    const { dueno, mascota } = await contexto();
    const [primera] = await subirFoto(mascota, dueno, await imagen());
    storage.fallarAlEliminar = true;
    await subirFoto(mascota, dueno, await imagen("#a36")); // primer fallo
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await reintentarEliminaciones({ maxIntentos: 3 }); // segundo
    await reintentarEliminaciones({ maxIntentos: 3 }); // tercero: se agota
    expect((await filasDe(mascota.id_mascota))[0]).toMatchObject({ estado: "por_eliminar", intentos_eliminar: 3 });
    expect(error).toHaveBeenCalledWith(`[archivos] ${primera.public_id} agotó sus 3 reintentos: hay que borrarlo a mano en Cloudinary.`);

    storage.fallarAlEliminar = false;
    await reintentarEliminaciones({ maxIntentos: 3 });
    expect((await filasDe(mascota.id_mascota))[0].estado).toBe("por_eliminar");
    error.mockRestore();
  });

  it("si la transacción falla, se borra lo subido y no queda registro", async () => {
    const { dueno, mascota } = await contexto();
    const error = await subirFoto(mascota, dueno, await imagen(), {
      actualizar: async () => {
        throw new Error("fallo en la transacción");
      },
    }).catch((err) => err);

    expect(error.message).toBe("fallo en la transacción");
    expect(storage.archivos.size).toBe(0);
    expect(await filasDe(mascota.id_mascota)).toEqual([]);
  });

  it("si la subida falla responde 503 y no toca la base", async () => {
    const { dueno, mascota } = await contexto();
    storage.fallarAlSubir = true;
    const error = await subirFoto(mascota, dueno, await imagen()).catch((err) => err);
    expect(error.status).toBe(503);
    expect(await filasDe(mascota.id_mascota)).toEqual([]);
  });
});

describe("eliminarArchivos", () => {
  it("marca, actualiza el registro y borra del almacenamiento", async () => {
    const { dueno, mascota } = await contexto();
    const [foto] = await subirFoto(mascota, dueno, await imagen());

    const eliminados = await eliminarArchivos({
      entidad: "mascota_foto",
      id_entidad: mascota.id_mascota,
      id_usuario: dueno.id_usuario,
      bloquear: (conn) => conn.query("SELECT id_mascota FROM mascotas WHERE id_mascota = ? FOR UPDATE", [mascota.id_mascota]),
      actualizar: (conn) => conn.query("UPDATE mascotas SET foto_url = NULL WHERE id_mascota = ?", [mascota.id_mascota]),
    });
    expect(eliminados.map((f) => f.id_archivo)).toEqual([foto.id_archivo]);
    expect(storage.archivos.size).toBe(0);
    const [[fila]] = await pool.query("SELECT estado, id_usuario_elimino, fecha_eliminacion FROM archivos WHERE id_archivo = ?", [foto.id_archivo]);
    expect(fila).toMatchObject({ estado: "eliminado", id_usuario_elimino: dueno.id_usuario });
    expect(fila.fecha_eliminacion).not.toBeNull();
  });
});

describe("formato", () => {
  it("un archivo privado sale con URL firmada que vence a los ARCHIVOS_URL_VIGENCIA_MIN minutos", () => {
    const antes = Date.now();
    const archivo = formatArchivoPrivado({
      id_archivo: 7,
      public_id: "petcat-test/historial/1/abc.pdf",
      tipo_recurso: "raw",
      entrega: "authenticated",
      formato: "pdf",
      bytes: 1234,
      nombre_original: "examen.pdf",
    });
    expect(archivo).toMatchObject({ id_archivo: 7, tipo: "pdf", nombre: "examen.pdf", bytes: 1234 });
    expect(archivo.url).toMatch(/^https:\/\/almacenamiento\.test\/privado\/petcat-test\/historial\/1\/abc\.pdf\?expira=\d+$/);
    const minutos = (new Date(archivo.url_expira_en) - antes) / 60_000;
    expect(minutos).toBeGreaterThan(14.9);
    expect(minutos).toBeLessThanOrEqual(15);
  });

  it("una URL externa guardada antes se devuelve igual, también como miniatura", () => {
    expect(conMiniaturas({ logo_url: "https://cdn.petcat.test/max.jpg", nombre: "Max" })).toEqual({
      logo_url: "https://cdn.petcat.test/max.jpg",
      logo_miniatura_url: "https://cdn.petcat.test/max.jpg",
      nombre: "Max",
    });
    expect(conMiniaturas({ foto_url: null })).toEqual({ foto_url: null, foto_miniatura_url: null });
  });

  it("sin credenciales, subir responde 503", async () => {
    const error = await almacenamientoSinConfigurar.subir(Buffer.from("x"), {}).catch((err) => err);
    expect(error.status).toBe(503);
    expect(error.message).toMatch(/no está configurado/);
  });
});

describe("variables de Cloudinary", () => {
  // env.js se valida al importarse: se prueba en un proceso aparte.
  const cargarEnv = (extra) =>
    spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("./src/config/env.js")'], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        DB_USER: "u",
        DB_PASSWORD: "p",
        DB_NAME: "petcat_db",
        JWT_SECRET: "a".repeat(32),
        REFRESH_SECRET: "b".repeat(32),
        SMTP_HOST: "smtp.test",
        ...extra,
      },
    });

  it("las tres credenciales van juntas", () => {
    const res = cargarEnv({ NODE_ENV: "development", CLOUDINARY_CLOUD_NAME: "demo" });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/CLOUDINARY_API_KEY: Las tres credenciales de Cloudinary van juntas/);
  });

  it("son obligatorias en producción y opcionales en desarrollo", () => {
    const produccion = cargarEnv({ NODE_ENV: "production" });
    expect(produccion.status).toBe(1);
    expect(produccion.stderr).toMatch(/CLOUDINARY_CLOUD_NAME: Obligatoria en producción/);
    expect(cargarEnv({ NODE_ENV: "development" }).status).toBe(0);
  });
});
