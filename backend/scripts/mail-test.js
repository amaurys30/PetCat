/**
 * Envía un correo de prueba con la configuración de correo actual.
 *
 *   npm run mail:test -- --to correo@ejemplo.com
 *   docker compose exec backend npm run mail:test -- --to correo@ejemplo.com
 *
 * Muestra la configuración (sin la contraseña), comprueba la conexión y la autenticación,
 * y envía. Si algo falla, explica la causa (credenciales, puerto, cifrado, tiempo de espera).
 */
import "../src/config/loadEnv.js";
import nodemailer from "nodemailer";
import { env } from "../src/config/env.js";
import {
  esDominioReservado,
  esEnvioReal,
  explicarErrorSmtp,
  modoSeguro,
  transportOptions,
} from "../src/shared/utils/mailer.js";

const args = process.argv.slice(2);
const indice = args.indexOf("--to");
const para = indice >= 0 ? args[indice + 1] : undefined;
if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
  console.error("Uso: npm run mail:test -- --to correo@ejemplo.com");
  process.exit(1);
}

if (!env.SMTP_HOST) {
  console.error(
    "SMTP_HOST está vacío: los correos solo se muestran en la consola de la API.\n" +
      "En Docker, el modo \"mailpit\" lo configura solo; fuera de Docker, define SMTP_HOST en backend/.env."
  );
  process.exit(1);
}

if (esEnvioReal(env) && esDominioReservado(para)) {
  console.error(
    `${para.split("@")[1]} es un dominio reservado que no recibe correo (.test, .example, .invalid, .localhost, ` +
      "example.com/.net/.org): con un SMTP real la API nunca envía ahí. Usa un correo tuyo que exista."
  );
  process.exit(1);
}

const opciones = transportOptions();
console.log("Configuración de correo:");
console.log(`  Servidor:   ${env.SMTP_HOST}:${env.SMTP_PORT}`);
console.log(`  Cifrado:    ${modoSeguro(env)}${env.SMTP_SECURE ? "" : " (deducido; define SMTP_SECURE para fijarlo)"}`);
console.log(`  Usuario:    ${env.SMTP_USER ?? "(sin autenticación)"}`);
console.log(`  Remitente:  ${env.MAIL_FROM}`);
console.log(`  Espera máx: ${env.SMTP_TIMEOUT_MS} ms`);
console.log(`  Para:       ${para}\n`);

const transporte = nodemailer.createTransport(opciones);
try {
  process.stdout.write("Conectando y autenticando... ");
  await transporte.verify();
  console.log("bien.");
  process.stdout.write("Enviando... ");
  const info = await transporte.sendMail({
    from: env.MAIL_FROM,
    to: para,
    subject: "Correo de prueba de PetCat",
    text: [
      "Si lees esto, la configuración de correo de PetCat funciona.",
      "",
      `Servidor: ${env.SMTP_HOST}:${env.SMTP_PORT} (${modoSeguro(env)})`,
      `Enviado: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`,
    ].join("\n"),
  });
  console.log(`enviado (${info.messageId}).`);
  if (env.SMTP_HOST === "mailpit" || env.SMTP_PORT === 1025) {
    console.log("Míralo en Mailpit: http://127.0.0.1:8025");
  }
  process.exit(0);
} catch (err) {
  console.log("falló.\n");
  console.error(explicarErrorSmtp(err));
  console.error(`\nDetalle técnico: ${err.code ?? ""} ${err.message}`);
  process.exit(1);
}
