import { describe, expect, it, vi } from "vitest";
import { crearEnviador, esDominioReservado, esEnvioReal } from "../../src/shared/utils/mailer.js";

const GMAIL = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: 587,
  SMTP_SECURE: "starttls",
  SMTP_USER: "petcat.pruebas@gmail.com",
  SMTP_PASS: "x",
  SMTP_TIMEOUT_MS: 10000,
  MAIL_FROM: "PetCat <petcat.pruebas@gmail.com>",
};
const MAILPIT = { SMTP_HOST: "mailpit", SMTP_PORT: 1025, SMTP_SECURE: "none", SMTP_TIMEOUT_MS: 10000, MAIL_FROM: "PetCat <no-reply@petcat.co>" };

/** Enviador con un SMTP falso: registra lo que llegaría al servidor y los avisos del registro. */
const enviadorFalso = (config) => {
  const enviados = [];
  const avisos = [];
  const transporte = { sendMail: vi.fn(async (mail) => (enviados.push(mail), { messageId: "<id@prueba>" })) };
  const enviar = crearEnviador({
    config,
    enTests: false,
    transporte: () => transporte,
    registro: { warn: (m) => avisos.push(m), log: () => {} },
  });
  return { enviar, enviados, avisos };
};

const correo = (to) => ({ to, subject: "Verifica tu correo", text: "Tu código es 123456" });

describe("dominios reservados", () => {
  it.each([
    "cliente@petcat.test",
    "ana@mail.example",
    "x@algo.invalid",
    "x@localhost",
    "x@example.com",
    "x@example.net",
    "x@example.org",
    "x@correo.example.com",
    "Ana Gómez <ana@petcat.test>",
    "CLIENTE@PETCAT.TEST",
    "x@petcat.test.",
  ])("%s es reservado", (direccion) => {
    expect(esDominioReservado(direccion)).toBe(true);
  });

  it.each(["ana@gmail.com", "ana@petcat.co", "x@test.com", "x@examples.com", "x@miexample.com", "x@testing.co", "sin-arroba"])(
    "%s no es reservado",
    (direccion) => {
      expect(esDominioReservado(direccion)).toBe(false);
    }
  );

  it("envío real: un SMTP de internet; Mailpit y el host local no", () => {
    expect(esEnvioReal(GMAIL)).toBe(true);
    expect(esEnvioReal(MAILPIT)).toBe(false);
    expect(esEnvioReal({ SMTP_HOST: "localhost" })).toBe(false);
    expect(esEnvioReal({ SMTP_HOST: "127.0.0.1" })).toBe(false);
    expect(esEnvioReal({})).toBe(false);
  });
});

describe("envío con un SMTP real (Gmail)", () => {
  it("a un dominio reservado no envía nada y deja un aviso sin la dirección completa", async () => {
    const { enviar, enviados, avisos } = enviadorFalso(GMAIL);
    const resultado = await enviar(correo("cliente@petcat.test"));

    expect(resultado).toEqual({ delivered: false, mode: "bloqueado" });
    expect(enviados).toHaveLength(0);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("c•••@petcat.test");
    expect(avisos[0]).toContain("dominio reservado");
    expect(avisos[0]).not.toContain("cliente@petcat.test");
    // El contenido (por ejemplo, un código) nunca va al registro.
    expect(avisos[0]).not.toContain("123456");
  });

  it("a una dirección real sí envía", async () => {
    const { enviar, enviados, avisos } = enviadorFalso(GMAIL);
    const resultado = await enviar(correo("ana@gmail.com"));

    expect(resultado).toMatchObject({ delivered: true, mode: "smtp" });
    expect(enviados).toEqual([expect.objectContaining({ to: "ana@gmail.com", from: GMAIL.MAIL_FROM })]);
    expect(avisos).toHaveLength(0);
  });

  it("con varios destinatarios, solo quita los reservados", async () => {
    const { enviar, enviados, avisos } = enviadorFalso(GMAIL);
    await enviar(correo("ana@gmail.com, x@example.com"));

    expect(enviados.map((m) => m.to)).toEqual(["ana@gmail.com"]);
    expect(avisos[0]).toContain("x•••@example.com");
  });
});

describe("Mailpit", () => {
  it("no bloquea: los correos a @petcat.test se siguen viendo en Mailpit (demo y códigos de la app)", async () => {
    const { enviar, enviados, avisos } = enviadorFalso(MAILPIT);
    const resultado = await enviar(correo("cliente@petcat.test"));

    expect(resultado).toMatchObject({ delivered: true, mode: "smtp" });
    expect(enviados.map((m) => m.to)).toEqual(["cliente@petcat.test"]);
    expect(avisos).toHaveLength(0);
  });
});
