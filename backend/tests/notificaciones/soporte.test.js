import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { TIPOS, lineaSoporte } from "../../src/modules/notificaciones/notificacion.tipos.js";
import { vencerSuscripciones } from "../../src/modules/suscripciones/suscripcion.jobs.js";
import { correoBienvenida } from "../../src/modules/auth/auth.mail.js";
import { api } from "../helpers/api.js";
import { crearNegocio, sinSilencio, tokenDe } from "../helpers/factories.js";

/** Contacto de soporte en los avisos del plan (soporte_email y soporte_whatsapp, migración 016). */

const configurarSoporte = async (email, whatsapp) => {
  await pool.query("UPDATE configuracion_global SET valor = ? WHERE clave = 'soporte_email'", [email]);
  await pool.query("UPDATE configuracion_global SET valor = ? WHERE clave = 'soporte_whatsapp'", [whatsapp]);
};

beforeEach(async () => {
  clearOutbox();
  await sinSilencio();
});
// Los valores de una instalación nueva.
afterEach(() => configurarSoporte("soporte@petcat.com.co", ""));

describe("línea de contacto", () => {
  it("según lo configurado; sin nada, null", () => {
    expect(lineaSoporte({ email: "soporte@petcat.com.co", whatsapp: "+57 300 123 4567" })).toBe(
      "Escríbenos a soporte@petcat.com.co o por WhatsApp al +57 300 123 4567."
    );
    expect(lineaSoporte({ email: "soporte@petcat.com.co", whatsapp: "" })).toBe("Escríbenos a soporte@petcat.com.co.");
    expect(lineaSoporte({ email: "", whatsapp: "+57 300 123 4567" })).toBe("Escríbenos por WhatsApp al +57 300 123 4567.");
    expect(lineaSoporte({ email: "", whatsapp: "" })).toBeNull();
  });

  it("los avisos del límite la agregan al final de la notificación de la app, no en la push", () => {
    const datos = { usadas: 24, maximo: 30, mes: "2026-10", plan: "Gratuito", soporte: { email: "soporte@petcat.com.co", whatsapp: "" } };
    const ochenta = TIPOS.plan_limite_80.contenido(datos);
    expect(ochenta.mensaje).toMatch(/Para mejorar tu plan, comunícate con PetCat\. Escríbenos a soporte@petcat\.com\.co\.$/);
    expect(ochenta.push).not.toContain("soporte@");

    const alcanzado = TIPOS.plan_limite_alcanzado.contenido({ ...datos, soporte: { email: "", whatsapp: "" } });
    expect(alcanzado.mensaje).toMatch(/comunícate con PetCat\.$/);
  });
});

describe("avisos del plan con el contacto configurado", () => {
  /** Negocio con la prueba Pro terminada ayer. */
  const pruebaVencida = async () => {
    const negocio = await crearNegocio(null, { nombre: "Clínica Patitas" });
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    await pool.query("UPDATE suscripciones SET estado = 'cancelada' WHERE id_negocio = ?", [negocio.id_negocio]);
    await pool.query(
      `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin, fecha_prueba_fin)
       VALUES (?, (SELECT id_plan FROM planes_suscripcion WHERE nombre = 'Pro'), 'en_prueba', ?, ?, ?)`,
      [negocio.id_negocio, hoyISO(ayer), hoyISO(ayer), hoyISO(ayer)]
    );
    return negocio;
  };
  const mensajeDe = async (usuario) => {
    const [[row]] = await pool.query("SELECT mensaje FROM notificaciones WHERE id_usuario = ? AND tipo = 'plan_vencido'", [usuario.id_usuario]);
    return row.mensaje;
  };

  it("correo y WhatsApp: en la notificación de la app y en el correo", async () => {
    await configurarSoporte("soporte@petcat.com.co", "+57 300 123 4567");
    const negocio = await pruebaVencida();
    await vencerSuscripciones();

    const linea = "Escríbenos a soporte@petcat.com.co o por WhatsApp al +57 300 123 4567.";
    expect(await mensajeDe(negocio.propietario)).toMatch(new RegExp(`comunícate con PetCat\\. ${linea.replace(/[.+]/g, "\\$&")}$`));
    const correo = outbox.find((c) => c.to === negocio.propietario.email);
    expect(correo.text).toContain(linea);
  });

  it("sin contacto configurado se omite la línea", async () => {
    await configurarSoporte("", "");
    const negocio = await pruebaVencida();
    await vencerSuscripciones();

    expect(await mensajeDe(negocio.propietario)).toMatch(/Para volver al plan Pro, comunícate con PetCat\.$/);
    const correo = outbox.find((c) => c.to === negocio.propietario.email);
    expect(correo.text).not.toContain("Escríbenos");
  });
});

describe("correo de bienvenida", () => {
  const base = { token: "a".repeat(64), email: "rosa@correo.test", nombre: "Rosa", negocio: "Clínica Patitas", minutos: 10080, politicaUrl: "" };

  it("con soporte_email lo muestra; sin él, remite al negocio", () => {
    expect(correoBienvenida({ ...base, soporte: "soporte@petcat.com.co" }).text).toContain(
      "Si no reconoces este registro, escríbenos a soporte@petcat.com.co."
    );
    const sinSoporte = correoBienvenida({ ...base, soporte: "" });
    expect(sinSoporte.text).toContain("Si no reconoces este registro, comunícate con Clínica Patitas.");
    expect(sinSoporte.html).toContain("comunícate con Clínica Patitas.");
  });
});

describe("contacto de soporte en la suscripción del panel", () => {
  it("GET /suscripcion trae el correo y el WhatsApp configurados; lo vacío llega en null", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);
    const url = `/negocios/${negocio.id_negocio}/suscripcion`;

    await configurarSoporte("soporte@petcat.com.co", "+57 300 123 4567");
    expect((await api(token).get(url)).body.data.soporte).toEqual({ email: "soporte@petcat.com.co", whatsapp: "+57 300 123 4567" });

    await configurarSoporte("  ", "");
    expect((await api(token).get(url)).body.data.soporte).toEqual({ email: null, whatsapp: null });
  });

  it("también al activar la prueba Pro", async () => {
    const negocio = await crearNegocio();
    const res = await api(await tokenDe(negocio.propietario)).post(`/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`);
    expect(res.status).toBe(201);
    expect(res.body.data.soporte).toEqual({ email: "soporte@petcat.com.co", whatsapp: null });
  });
});
