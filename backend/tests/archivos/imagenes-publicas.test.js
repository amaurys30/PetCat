import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { pool } from "../../src/config/db.js";
import { storage } from "../../src/shared/utils/storage.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearMascota, crearNegocio, crearRol, crearUsuario, tokenDe } from "../helpers/factories.js";

afterEach(() => storage.reiniciar());

/** JPEG con EXIF y ubicación GPS, como la foto de un celular. */
const fotoConGps = (color = "#c33") =>
  sharp({ create: { width: 120, height: 90, channels: 3, background: color } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "9/1 18/1 0/1" } })
    .toBuffer();

const pngTransparente = () =>
  sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

const subir = async (token, ruta, campo = "foto", buffer) =>
  api(token).put(ruta).attach(campo, buffer ?? (await fotoConGps()), "foto.jpg");

const publicIdDe = (url) => url.replace(/^https:\/\/almacenamiento\.test\/(media|ancha)\//, "");

const estadosDe = async (entidad, id_entidad) => {
  const [rows] = await pool.query(
    "SELECT estado FROM archivos WHERE entidad = ? AND id_entidad = ? ORDER BY id_archivo",
    [entidad, id_entidad]
  );
  return rows.map((r) => r.estado);
};

describe("PUT|DELETE /auth/me/foto", () => {
  it("sube la foto sin metadatos, con miniatura, y el reemplazo borra la anterior", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);

    const primera = await subir(token, "/auth/me/foto");
    expect(primera.status).toBe(200);
    expect(primera.body.message).toBe("Foto de perfil actualizada");
    const { foto_url, foto_miniatura_url } = primera.body.data;
    expect(foto_url).toMatch(new RegExp(`^https://almacenamiento\\.test/media/petcat-test/usuarios/${usuario.id_usuario}/[0-9a-f]{24}$`));
    expect(foto_miniatura_url).toBe(foto_url.replace("/media/", "/miniatura/"));
    const guardado = storage.archivos.get(publicIdDe(foto_url));
    expect((await sharp(guardado.buffer).metadata()).exif).toBeUndefined();

    const segunda = await subir(token, "/auth/me/foto", "foto", await fotoConGps("#3a6"));
    expect(segunda.body.data.foto_url).not.toBe(foto_url);
    expect(storage.archivos.has(publicIdDe(foto_url))).toBe(false);
    expect(await estadosDe("usuario_foto", usuario.id_usuario)).toEqual(["eliminado", "activo"]);

    const me = await api(token).get("/auth/me");
    expect(me.body.data).toMatchObject({ foto_url: segunda.body.data.foto_url, foto_miniatura_url: expect.any(String) });
  });

  it("DELETE la quita (404 si no hay); sin archivo o con un archivo que no es imagen, 422 sin subir nada", async () => {
    const token = await tokenDe(await crearUsuario());
    await subir(token, "/auth/me/foto");

    const eliminar = await api(token).delete("/auth/me/foto");
    expect(eliminar.status).toBe(200);
    expect(eliminar.body.data).toMatchObject({ foto_url: null, foto_miniatura_url: null });
    expect(storage.archivos.size).toBe(0);
    expect((await api(token).delete("/auth/me/foto")).body.message).toBe("No tienes foto de perfil");

    const sinArchivo = await api(token).put("/auth/me/foto").send({ foto_url: "https://x.test/a.jpg" });
    expect(sinArchivo.status).toBe(422);
    const texto = await api(token).put("/auth/me/foto").attach("foto", Buffer.from("hola"), "foto.jpg");
    expect(texto.status).toBe(422);
    expect(texto.body.errors).toEqual({ archivo: "Tipo de archivo no admitido: debe ser JPEG, PNG o WebP" });
    expect(storage.archivos.size).toBe(0);
  });

  it("401 sin token", async () => {
    expect((await api().put("/auth/me/foto").attach("foto", await fotoConGps(), "a.jpg")).status).toBe(401);
  });
});

describe("PUT|DELETE /mascotas/:id_mascota/foto", () => {
  it("el dueño sube la foto y aparece con su miniatura en el listado", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno);
    const token = await tokenDe(dueno);

    const res = await subir(token, `/mascotas/${mascota.id_mascota}/foto`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Foto de la mascota actualizada");
    expect(res.body.data.foto_url).toContain(`/petcat-test/mascotas/${mascota.id_mascota}/`);

    const lista = await api(token).get("/mascotas");
    expect(lista.body.data[0]).toMatchObject({ foto_url: res.body.data.foto_url, foto_miniatura_url: res.body.data.foto_miniatura_url });

    const eliminar = await api(token).delete(`/mascotas/${mascota.id_mascota}/foto`);
    expect(eliminar.body.data.foto_url).toBeNull();
    expect((await api(token).delete(`/mascotas/${mascota.id_mascota}/foto`)).status).toBe(404);
  });

  it("la foto de la mascota se guarda sin EXIF ni ubicación GPS (ni XMP), también la miniatura", async () => {
    const dueno = await crearUsuario();
    const mascota = await crearMascota(dueno);
    const original = await fotoConGps();
    // La foto de prueba sí trae la ubicación, como la de un celular.
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const res = await subir(await tokenDe(dueno), `/mascotas/${mascota.id_mascota}/foto`, "foto", original);
    expect(res.status).toBe(200);

    const guardado = storage.archivos.get(publicIdDe(res.body.data.foto_url));
    const meta = await sharp(guardado.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    // Ni rastro de las etiquetas GPS en los bytes.
    expect(guardado.buffer.includes(Buffer.from("GPS"))).toBe(false);
  });

  it("otro usuario recibe 403 y no se sube nada; inexistente o eliminada, 404", async () => {
    const mascota = await crearMascota(await crearUsuario());
    const token = await tokenDe(await crearUsuario());
    expect((await subir(token, `/mascotas/${mascota.id_mascota}/foto`)).status).toBe(403);
    expect(storage.archivos.size).toBe(0);

    const dueno = await crearUsuario();
    const eliminada = await crearMascota(dueno, { activo: false });
    expect((await subir(await tokenDe(dueno), `/mascotas/${eliminada.id_mascota}/foto`)).status).toBe(404);
    expect((await subir(token, "/mascotas/999999/foto")).status).toBe(404);
  });
});

describe("PUT|DELETE /empleados/:id_empleado/foto", () => {
  it("el propietario la sube; el propio empleado puede cambiar la suya sin empleados.editar", async () => {
    const negocio = await crearNegocio();
    const usuario = await crearUsuario();
    const empleado = await crearEmpleado(negocio, { usuario, rol: "Recepcionista" });

    const propietario = await subir(await tokenDe(negocio.propietario), `/empleados/${empleado.id_empleado}/foto`);
    expect(propietario.status).toBe(200);
    expect(propietario.body.data).toMatchObject({ id_empleado: empleado.id_empleado, foto_miniatura_url: expect.any(String) });

    const propio = await subir(await tokenDe(usuario), `/empleados/${empleado.id_empleado}/foto`, "foto", await fotoConGps("#36a"));
    expect(propio.status).toBe(200);
    expect(await estadosDe("empleado_foto", empleado.id_empleado)).toEqual(["eliminado", "activo"]);

    const lista = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/empleados`);
    expect(lista.body.data[0]).toMatchObject({ foto_url: propio.body.data.foto_url, foto_miniatura_url: expect.any(String) });
  });

  it("403 para otro empleado sin permiso y para uno con permiso sobre alguien con más permisos", async () => {
    const negocio = await crearNegocio();
    const admin = await crearEmpleado(negocio, { rol: "Administrador" });
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await subir(await tokenDe(recepcion), `/empleados/${admin.id_empleado}/foto`)).status).toBe(403);

    const editor = await crearUsuario();
    const rol = await crearRol(negocio, { empleados: ["ver", "editar"] });
    await crearEmpleado(negocio, { usuario: editor, rol: rol.id_rol });
    const res = await subir(await tokenDe(editor), `/empleados/${admin.id_empleado}/foto`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No puedes modificar a un empleado con permisos que tu rol no tiene");
    expect(storage.archivos.size).toBe(0);
  });

  it("foto_url ya no se acepta en el body (422)", async () => {
    const negocio = await crearNegocio();
    const empleado = await crearEmpleado(negocio);
    const res = await api(await tokenDe(negocio.propietario))
      .patch(`/empleados/${empleado.id_empleado}`)
      .send({ foto_url: "https://x.test/a.jpg" });
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty("foto_url");
  });
});

describe("PUT|DELETE /negocios/:id_negocio/logo y /banner", () => {
  it("el logo conserva la transparencia en WebP y sale con miniatura en mios y en el perfil público", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);

    const res = await subir(token, `/negocios/${negocio.id_negocio}/logo`, "logo", await pngTransparente());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logo actualizado");
    const guardado = storage.archivos.get(publicIdDe(res.body.data.logo_url));
    const meta = await sharp(guardado.buffer).metadata();
    expect(meta).toMatchObject({ format: "webp", hasAlpha: true });

    const mios = await api(token).get("/negocios/mios");
    expect(mios.body.data[0]).toMatchObject({ logo_url: res.body.data.logo_url, logo_miniatura_url: expect.any(String) });
  });

  it("el banner usa la versión ancha; DELETE sin banner da 404", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);
    const ruta = `/negocios/${negocio.id_negocio}/banner`;
    expect((await api(token).delete(ruta)).status).toBe(404);

    const res = await subir(token, ruta, "banner");
    expect(res.status).toBe(200);
    expect(res.body.data.banner_url).toMatch(/^https:\/\/almacenamiento\.test\/ancha\/petcat-test\/negocios\//);
    expect((await api(token).delete(ruta)).body.data.banner_url).toBeNull();
  });

  it("requiere configuracion.editar; logo_url y banner_url ya no se aceptan en el PATCH", async () => {
    const negocio = await crearNegocio();
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await subir(await tokenDe(recepcion), `/negocios/${negocio.id_negocio}/logo`, "logo")).status).toBe(403);
    expect(storage.archivos.size).toBe(0);

    const res = await api(await tokenDe(negocio.propietario))
      .patch(`/negocios/${negocio.id_negocio}`)
      .send({ logo_url: "https://x.test/a.png", banner_url: "https://x.test/b.png" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["banner_url", "logo_url"]);
  });
});
