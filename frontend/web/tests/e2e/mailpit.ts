import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Correos de la API de demo en las pruebas de punta a punta: backend-demo envía a Mailpit
 * (MAIL_MODO_DEMO=mailpit, el valor por defecto). Se leen con su API.
 * Otra dirección: $env:MAILPIT_URL="http://127.0.0.1:8025"
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

interface Resumen {
  ID: string;
  Created: string;
}

/**
 * Espera el último correo enviado a `para` y devuelve el primer texto que coincida con
 * `patron` (su grupo 1 si lo tiene). Falla con un mensaje claro si no llega.
 */
export async function leerDeCorreo(
  request: APIRequestContext,
  para: string,
  patron: RegExp,
  { timeout = 10_000 } = {},
): Promise<string> {
  let encontrado: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${para}"`, limit: 1 },
        });
        if (!res.ok()) return `Mailpit respondió ${res.status()} (¿está corriendo en ${MAILPIT}?)`;
        const { messages } = (await res.json()) as { messages: Resumen[] };
        const ultimo = messages[0];
        if (!ultimo) return `sin correos para ${para}`;
        const mensaje = (await (await request.get(`${MAILPIT}/api/v1/message/${ultimo.ID}`)).json()) as {
          Text: string;
        };
        const coincidencia = patron.exec(mensaje.Text);
        if (!coincidencia) return `el correo para ${para} no tiene ${patron}`;
        encontrado = coincidencia[1] ?? coincidencia[0];
        return "listo";
      },
      { timeout, message: `Correo para ${para} en Mailpit` },
    )
    .toBe("listo");
  return encontrado!;
}
