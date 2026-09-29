import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { storage } from "../../src/shared/utils/storage.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHistorial,
  crearMascota,
  crearNegocio,
  crearUsuario,
  crearVacuna,
  tokenDe,
} from "../helpers/factories.js";

afterEach(() => storage.reiniciar());

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const radiografia = () =>
  sharp({ create: { width: 300, height: 200, channels: 3, background: "#999" } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "9/1 18/1 0/1" } })
    .toBuffer();

const URL_FIRMADA = /^https:\/\/almacenamiento\.test\/privado\/petcat-test\/.+\?expira=\d+$/;

/**
 * Mascota con cita en dos clínicas (A y B). A tiene una veterinaria con cuenta y un
 * registro de historial; hay una vacuna del dueño y otra de A.
 */
const contexto = async () => {
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  const clinicaA = await crearNegocio();
  const clinicaB = await crearNegocio();
  const usuarioVet = await crearUsuario();
  await crearEmpleado(clinicaA, { usuario: usuarioVet, rol: "Veterinario" });
  await crearCita(clinicaA, { cliente, mascota, estado: "completada", fecha: hoyISO() });
  await crearCita(clinicaB, { cliente, mascota, estado: "completada", fecha: hoyISO() });
  const registro = await crearHistorial(clinicaA, mascota, { diagnostico: "Fractura" });
  const vacunaDueno = await crearVacuna(mascota, { nombre_vacuna: "Rabia" });
  const vacunaA = await crearVacuna(mascota, { nombre_vacuna: "Parvovirus", id_negocio: clinicaA.id_negocio });
  return {
    cliente,
    mascota,
    clinicaA,
    clinicaB,
    registro,
    vacunaDueno,
    vacunaA,
    tokenCliente: await tokenDe(cliente),
    tokenVet: await tokenDe(usuarioVet),
    tokenA: await tokenDe(clinicaA.propietario),
    tokenB: await tokenDe(clinicaB.propietario),
  };
};

const agregar = async (token, registro, archivos) => {
  let req = api(token).post(`/historial/${registro.id_historial}/archivos`);
  for (const [buffer, nombre] of archivos) req = req.attach("archivos", buffer, nombre);
  return req;
};

describe("archivos del historial", () => {
  it("el negocio que creó el registro sube imágenes y PDF privados; salen con URL firmada que vence", async () => {
    const ctx = await contexto();
    const res = await agregar(ctx.tokenVet, ctx.registro, [
      [await radiografia(), "radiografía.jpg"],
      [PDF, "examen.pdf"],
    ]);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Archivos agregados");
    const [imagen, pdf] = res.body.data.archivos;
    expect(imagen).toMatchObject({ tipo: "imagen", nombre: "radiografía.jpg", externo: false, url: expect.stringMatching(URL_FIRMADA) });
    expect(pdf).toMatchObject({ tipo: "pdf", nombre: "examen.pdf", externo: false });
    expect(new Date(imagen.url_expira_en) > new Date()).toBe(true);

    // Guardados privados; la imagen en JPEG sin EXIF/GPS y el PDF sin cambios.
    const guardados = [...storage.archivos.values()];
    expect(guardados.map((g) => g.entrega)).toEqual(["authenticated", "authenticated"]);
    const meta = await sharp(guardados.find((g) => g.tipoRecurso === "image").buffer).metadata();
    expect(meta).toMatchObject({ format: "jpeg" });
    expect(meta.exif).toBeUndefined();
    expect(guardados.find((g) => g.tipoRecurso === "raw").buffer.equals(PDF)).toBe(true);
  });

  it("el dueño los ve; otro negocio con cita también, salvo que la mascota no comparta el historial", async () => {
    const ctx = await contexto();
    await agregar(ctx.tokenVet, ctx.registro, [[PDF, "examen.pdf"]]);

    const dueno = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(dueno.body.data[0].archivos).toEqual([expect.objectContaining({ tipo: "pdf", url: expect.stringMatching(URL_FIRMADA) })]);

    const rutaB = `/negocios/${ctx.clinicaB.id_negocio}/mascotas/${ctx.mascota.id_mascota}/historial`;
    expect((await api(ctx.tokenB).get(rutaB)).body.data[0].archivos).toHaveLength(1);

    await pool.query("UPDATE mascotas SET compartir_historial = FALSE WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    const sinCompartir = await api(ctx.tokenB).get(rutaB);
    expect(sinCompartir.body.data).toEqual([]);
  });

  it("otro negocio no puede subir ni borrar; el tipo real y el cupo de 10 por registro se validan", async () => {
    const ctx = await contexto();
    expect((await agregar(ctx.tokenB, ctx.registro, [[PDF, "a.pdf"]])).status).toBe(403);
    expect(storage.archivos.size).toBe(0);

    const texto = await agregar(ctx.tokenVet, ctx.registro, [[PDF, "a.pdf"], [Buffer.from("hola"), "nota.pdf"]]);
    expect(texto.status).toBe(422);
    expect(texto.body.errors).toEqual({ archivo: "nota.pdf: Tipo de archivo no admitido: debe ser JPEG, PNG, WebP o PDF" });
    expect(storage.archivos.size).toBe(0);

    const cinco = Array.from({ length: 5 }, (_, i) => [PDF, `a${i}.pdf`]);
    expect((await agregar(ctx.tokenVet, ctx.registro, cinco)).status).toBe(201);
    expect((await agregar(ctx.tokenVet, ctx.registro, cinco)).status).toBe(201);
    const once = await agregar(ctx.tokenVet, ctx.registro, [[PDF, "b.pdf"]]);
    expect(once.status).toBe(422);
    expect(once.body.errors).toEqual({ archivo: "Un registro admite hasta 10 archivos: tiene 10 y se enviaron 1" });
    expect(storage.archivos.size).toBe(10);
  });

  it("DELETE quita un archivo del registro; otro id o de otro registro da 404", async () => {
    const ctx = await contexto();
    const subida = await agregar(ctx.tokenVet, ctx.registro, [[PDF, "a.pdf"], [PDF, "b.pdf"]]);
    const [a, b] = subida.body.data.archivos;

    const res = await api(ctx.tokenVet).delete(`/historial/${ctx.registro.id_historial}/archivos/${a.id_archivo}`);
    expect(res.status).toBe(200);
    expect(res.body.data.archivos.map((x) => x.id_archivo)).toEqual([b.id_archivo]);
    expect(storage.archivos.size).toBe(1);
    const [[fila]] = await pool.query("SELECT estado, id_usuario_elimino FROM archivos WHERE id_archivo = ?", [a.id_archivo]);
    expect(fila.estado).toBe("eliminado");

    expect((await api(ctx.tokenVet).delete(`/historial/${ctx.registro.id_historial}/archivos/${a.id_archivo}`)).status).toBe(404);
    const otro = await crearHistorial(ctx.clinicaA, ctx.mascota);
    expect((await api(ctx.tokenVet).delete(`/historial/${otro.id_historial}/archivos/${b.id_archivo}`)).status).toBe(404);
    expect((await api(ctx.tokenB).delete(`/historial/${ctx.registro.id_historial}/archivos/${b.id_archivo}`)).status).toBe(403);
  });

  it("las URLs guardadas antes de la 2.2 se leen como externas", async () => {
    const ctx = await contexto();
    await pool.query("UPDATE historial_medico SET archivos_json = ? WHERE id_historial = ?", [
      JSON.stringify(["https://cdn.petcat.test/rx.pdf"]),
      ctx.registro.id_historial,
    ]);
    const res = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(res.body.data[0].archivos).toEqual([{ url: "https://cdn.petcat.test/rx.pdf", externo: true }]);
  });
});

describe("comprobante de vacuna", () => {
  const subir = (token, vacuna, buffer, nombre = "carnet.jpg") =>
    api(token).put(`/vacunas/${vacuna.id_vacuna}/comprobante`).attach("comprobante", buffer, nombre);

  it("el dueño sube el comprobante de su vacuna; queda privado y lo ve el negocio con cita", async () => {
    const ctx = await contexto();
    const res = await subir(ctx.tokenCliente, ctx.vacunaDueno, await radiografia());
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Comprobante guardado");
    expect(res.body.data).toMatchObject({
      tiene_comprobante: true,
      comprobante: { tipo: "imagen", nombre: "carnet.jpg", externo: false, url: expect.stringMatching(URL_FIRMADA) },
    });
    expect([...storage.archivos.values()][0].entrega).toBe("authenticated");

    const panel = await api(ctx.tokenB).get(`/negocios/${ctx.clinicaB.id_negocio}/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    const rabia = panel.body.data.find((v) => v.id_vacuna === ctx.vacunaDueno.id_vacuna);
    expect(rabia.comprobante).toMatchObject({ tipo: "imagen", url: expect.stringMatching(URL_FIRMADA) });
  });

  it("reemplazar borra el anterior (también una URL externa) y DELETE lo quita", async () => {
    const ctx = await contexto();
    await pool.query("UPDATE vacunas SET comprobante_url = 'https://cdn.petcat.test/viejo.jpg' WHERE id_vacuna = ?", [
      ctx.vacunaA.id_vacuna,
    ]);
    const antes = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/vacunas`);
    expect(antes.body.data.find((v) => v.id_vacuna === ctx.vacunaA.id_vacuna).comprobante).toEqual({
      url: "https://cdn.petcat.test/viejo.jpg",
      externo: true,
    });

    const primera = await subir(ctx.tokenVet, ctx.vacunaA, PDF, "carnet.pdf");
    expect(primera.body.data.comprobante).toMatchObject({ tipo: "pdf", externo: false });
    const [[{ comprobante_url }]] = await pool.query("SELECT comprobante_url FROM vacunas WHERE id_vacuna = ?", [ctx.vacunaA.id_vacuna]);
    expect(comprobante_url).toBeNull();

    const segunda = await subir(ctx.tokenVet, ctx.vacunaA, await radiografia());
    expect(segunda.body.data.comprobante.id_archivo).not.toBe(primera.body.data.comprobante.id_archivo);
    expect(storage.archivos.size).toBe(1);

    const eliminar = await api(ctx.tokenVet).delete(`/vacunas/${ctx.vacunaA.id_vacuna}/comprobante`);
    expect(eliminar.body.data).toMatchObject({ tiene_comprobante: false, comprobante: null });
    expect(storage.archivos.size).toBe(0);
    const otraVez = await api(ctx.tokenVet).delete(`/vacunas/${ctx.vacunaA.id_vacuna}/comprobante`);
    expect(otraVez.status).toBe(404);
    expect(otraVez.body.message).toBe("La vacuna no tiene comprobante");
  });

  it("la vacuna del dueño no la toca el negocio ni la del negocio el dueño; otro usuario, 403", async () => {
    const ctx = await contexto();
    expect((await subir(ctx.tokenVet, ctx.vacunaDueno, PDF, "a.pdf")).status).toBe(403);
    expect((await subir(ctx.tokenCliente, ctx.vacunaA, PDF, "a.pdf")).status).toBe(403);
    expect((await subir(ctx.tokenB, ctx.vacunaA, PDF, "a.pdf")).status).toBe(403);
    expect((await subir(await tokenDe(await crearUsuario()), ctx.vacunaDueno, PDF, "a.pdf")).status).toBe(403);
    expect(storage.archivos.size).toBe(0);
  });
});
