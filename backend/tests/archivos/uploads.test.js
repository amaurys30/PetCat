import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import { archivoUnico, archivosDe, limpiarNombre, procesarArchivo, recibirArchivos } from "../../src/shared/utils/uploads.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";

const MB = 1024 * 1024;

/** JPEG de prueba con EXIF (derechos de autor y ubicación GPS) y orientación 6 (girada 90°). */
const jpegConGps = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Copyright: "Dueño de prueba" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "9/1 18/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "75/1 23/1 0/1" },
    })
    .toBuffer();

const png = (width, height) => sharp({ create: { width, height, channels: 4, background: "#0000" } }).png().toBuffer();

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
// Cabecera ISO-BMFF de una foto HEIC de iPhone.
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(4), Buffer.from("mif1heic"), Buffer.alloc(64)]);

const archivo = (buffer, originalname = "foto.jpg") => ({ buffer, originalname });

const errorDe = async (promesa) => {
  try {
    await promesa;
  } catch (err) {
    return err;
  }
  throw new Error("Se esperaba un error");
};

describe("procesarArchivo", () => {
  it("quita el EXIF y la ubicación GPS, aplica la orientación y guarda las públicas en WebP", async () => {
    const original = await jpegConGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const procesado = await procesarArchivo(archivo(original), "mascota_foto");
    const meta = await sharp(procesado.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(meta.format).toBe("webp");
    // La orientación 6 se aplicó: 64x48 queda 48x64.
    expect(procesado).toMatchObject({ tipoRecurso: "image", formato: "webp", ancho: 48, alto: 64, nombre_original: "foto.jpg" });
    expect(procesado.buffer.includes(Buffer.from("GPS"))).toBe(false);
    expect(procesado.buffer.includes(Buffer.from("Dueño de prueba"))).toBe(false);
  });

  it("las imágenes privadas (médicas) quedan en JPEG sin metadatos y se reducen a 2048 px", async () => {
    const grande = await png(3000, 1500);
    const procesado = await procesarArchivo(archivo(grande, "radiografia.png"), "historial_archivo");
    expect(procesado).toMatchObject({ formato: "jpg", ancho: 2048, alto: 1024 });
    const meta = await sharp(procesado.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
  });

  it("el tipo sale del contenido: un texto con extensión .jpg y un PDF como foto dan 422", async () => {
    const texto = await errorDe(procesarArchivo(archivo(Buffer.from("no soy una imagen"), "foto.jpg"), "mascota_foto"));
    expect(texto.status).toBe(422);
    expect(texto.errors).toEqual({ archivo: "Tipo de archivo no admitido: debe ser JPEG, PNG o WebP" });

    const pdfComoFoto = await errorDe(procesarArchivo(archivo(PDF, "foto.png"), "usuario_foto"));
    expect(pdfComoFoto.errors.archivo).toBe("Tipo de archivo no admitido: debe ser JPEG, PNG o WebP");
  });

  it("PDF solo en comprobantes e historial, sin cambios", async () => {
    const procesado = await procesarArchivo(archivo(PDF, "carnet.pdf"), "vacuna_comprobante");
    expect(procesado).toMatchObject({ tipoRecurso: "raw", formato: "pdf", bytes: PDF.length, nombre_original: "carnet.pdf" });
    expect(procesado.buffer.equals(PDF)).toBe(true);
  });

  it("HEIC se rechaza con un mensaje que pide convertirlo a JPEG", async () => {
    const err = await errorDe(procesarArchivo(archivo(HEIC, "IMG_0001.HEIC"), "mascota_foto"));
    expect(err.status).toBe(422);
    expect(err.errors.archivo).toBe("Las fotos HEIC/HEIF no se admiten: conviértelas a JPEG antes de subirlas");
  });

  it("rechaza imágenes de más de 40 megapíxeles y las dañadas", async () => {
    const enorme = await png(8000, 6000); // 48 MP, pocos KB
    expect((await errorDe(procesarArchivo(archivo(enorme, "x.png"), "mascota_foto"))).errors.archivo).toBe(
      "La imagen supera el máximo de 40 megapíxeles"
    );

    const buena = await jpegConGps();
    const dañada = Buffer.concat([buena.subarray(0, 200), Buffer.alloc(200)]);
    expect((await errorDe(procesarArchivo(archivo(dañada), "mascota_foto"))).errors.archivo).toBe(
      "La imagen está dañada o no se puede leer"
    );
  });

  it("limpiarNombre recupera UTF-8, quita rutas y recorta", () => {
    expect(limpiarNombre(Buffer.from("vacunación ñandú.pdf", "utf8").toString("latin1"))).toBe("vacunación ñandú.pdf");
    expect(limpiarNombre("C:\\fotos\\..\\max.jpg")).toBe("max.jpg");
    expect(limpiarNombre("a".repeat(300)).length).toBe(255);
    expect(limpiarNombre(undefined)).toBeNull();
  });
});

describe("recibirArchivos", () => {
  // App mínima: recibe y responde lo que llegó, con el errorHandler real.
  const appPara = (entidad, varios = false) => {
    const app = express();
    app.post("/subir", recibirArchivos(entidad), (req, res) => {
      const archivos = varios ? archivosDe(req, entidad) : [archivoUnico(req, entidad)];
      res.json({ archivos: archivos.map((a) => ({ nombre: a.originalname, bytes: a.size })) });
    });
    app.use(errorHandler);
    return app;
  };

  it("recibe el archivo del campo del destino", async () => {
    const res = await request(appPara("mascota_foto")).post("/subir").attach("foto", Buffer.from("x"), "a.jpg");
    expect(res.status).toBe(200);
    expect(res.body.archivos).toEqual([{ nombre: "a.jpg", bytes: 1 }]);
  });

  it("422 si supera el tamaño, si viene en otro campo o si no llega archivo", async () => {
    const app = appPara("mascota_foto");
    const grande = await request(app).post("/subir").attach("foto", Buffer.alloc(5 * MB + 1), "a.jpg");
    expect(grande.status).toBe(422);
    expect(grande.body.errors).toEqual({ archivo: "El archivo supera el máximo de 5 MB" });

    const otroCampo = await request(app).post("/subir").attach("imagen", Buffer.from("x"), "a.jpg");
    expect(otroCampo.body.errors).toEqual({ archivo: 'El archivo debe enviarse en el campo "foto"' });

    const sinArchivo = await request(app).post("/subir").send({ foto: "https://x.test/a.jpg" });
    expect(sinArchivo.status).toBe(422);
    expect(sinArchivo.body.errors.archivo).toMatch(/^Falta el archivo/);
  });

  it("historial: hasta 5 archivos por solicitud", async () => {
    const app = appPara("historial_archivo", true);
    let cinco = request(app).post("/subir");
    for (let i = 0; i < 5; i++) cinco = cinco.attach("archivos", Buffer.from("x"), `a${i}.pdf`);
    expect((await cinco).status).toBe(200);

    let seis = request(app).post("/subir");
    for (let i = 0; i < 6; i++) seis = seis.attach("archivos", Buffer.from("x"), `a${i}.pdf`);
    const res = await seis;
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ archivo: "Se pueden enviar como máximo 5 archivos" });
  });
});
