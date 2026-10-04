import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import type { Invitacion } from "@/api/invitaciones";
import { useAuth } from "@/stores/auth";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const TOKEN = "d".repeat(64);
const URL_INVITACION = `/invitacion/${TOKEN}`;

const invitacion = (cambios: Partial<Invitacion> = {}): Invitacion => ({
  negocio: { id_negocio: 1, nombre: "Clínica Veterinaria Patitas", logo_url: null },
  rol: { nombre: "Veterinario" },
  empleado: { nombre: "Carlos", apellido: "Martínez" },
  email: "carlos@petcat.test",
  expiracion: "2026-09-28 09:00:00",
  cuenta_existente: false,
  requiere_aceptar_politica: true,
  ...cambios,
});

const carlos = usuarioDemo({
  id_usuario: 9,
  nombre: "Carlos",
  email: "carlos@petcat.test",
  negocios: [
    negocioDemo({
      relacion: "empleado",
      rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"] } },
    }),
  ],
});

const conInvitacion = (datos = invitacion()) => http.get(`${API}/invitaciones/:token`, () => ok(datos));
const sesionNueva = { access_token: "nuevo", refresh_token: "r-nuevo", usuario: {} };

beforeEach(() => __reiniciarSesionParaPruebas());

describe("A4 · Aceptar invitación sin cuenta", () => {
  it("muestra el negocio, el rol y el vencimiento, con el nombre precargado", async () => {
    servidor.use(conInvitacion());
    renderRuta(URL_INVITACION);
    expect(await screen.findByRole("heading", { name: "Clínica Veterinaria Patitas" })).toBeInTheDocument();
    expect(screen.getByText("te invitó como Veterinario")).toBeInTheDocument();
    expect(
      screen.getByText(/Invitación para carlos@petcat.test · vence el 28 de septiembre, 9:00 a.m./),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Carlos");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Martínez");
  });

  it("exige la política y una contraseña válida antes de llamar a la API", async () => {
    servidor.use(conInvitacion());
    renderRuta(URL_INVITACION);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Contraseña"), "corta");
    await user.click(screen.getByRole("button", { name: "Aceptar y entrar" }));
    expect(await screen.findByText("Debe tener al menos 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Debes aceptar la política de tratamiento de datos")).toBeInTheDocument();
  });

  it("crea la cuenta, inicia sesión y entra al negocio que invitó", async () => {
    let cuerpo: unknown;
    servidor.use(
      conInvitacion(),
      http.post(`${API}/invitaciones/:token/aceptar`, async ({ request }) => {
        cuerpo = await request.json();
        return ok(sesionNueva);
      }),
      http.get(`${API}/auth/me`, () => ok(carlos)),
    );
    const { router } = renderRuta(URL_INVITACION);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Contraseña"), "Carlos1234");
    await user.click(screen.getByLabelText(/Acepto la política/));
    await user.click(screen.getByRole("button", { name: "Aceptar y entrar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/agenda"));
    expect(cuerpo).toEqual({
      nombre: "Carlos",
      apellido: "Martínez",
      password: "Carlos1234",
      acepta_politica_datos: true,
    });
    expect(useAuth.getState().usuario?.email).toBe("carlos@petcat.test");
  });
});

describe("A4 · Aceptar invitación con cuenta existente", () => {
  const existente = invitacion({ cuenta_existente: true, requiere_aceptar_politica: false });

  it("pide solo la contraseña actual, con el correo bloqueado y el enlace para recuperarla", async () => {
    servidor.use(conInvitacion(existente));
    renderRuta(URL_INVITACION);
    expect(await screen.findByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Acepto la política/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "¿La olvidaste?" })).toHaveAttribute(
      "href",
      "/recuperar-password?email=carlos%40petcat.test",
    );
  });

  it("contraseña incorrecta (401) va en el campo y no cierra ninguna sesión", async () => {
    servidor.use(
      conInvitacion(existente),
      http.post(`${API}/invitaciones/:token/aceptar`, () => fallo(401, "Contraseña incorrecta")),
    );
    renderRuta(URL_INVITACION);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Contraseña actual"), "mala");
    await user.click(screen.getByRole("button", { name: "Aceptar y entrar" }));
    expect(await screen.findByText("Contraseña incorrecta")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cuenta bloqueada (403) muestra el mensaje y ofrece restablecer", async () => {
    servidor.use(
      conInvitacion(existente),
      http.post(`${API}/invitaciones/:token/aceptar`, () =>
        fallo(403, "Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en 15 minutos"),
      ),
    );
    renderRuta(URL_INVITACION);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Contraseña actual"), "mala");
    await user.click(screen.getByRole("button", { name: "Aceptar y entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cuenta bloqueada");
    expect(screen.getByRole("link", { name: "Restablecer contraseña" })).toBeInTheDocument();
  });

  it("con otra cuenta abierta lo avisa y al aceptar cierra esa sesión y entra con la invitada", async () => {
    let logout = false;
    servidor.use(
      conInvitacion(existente),
      http.post(`${API}/invitaciones/:token/aceptar`, () => ok(sesionNueva)),
      http.post(`${API}/auth/logout`, () => {
        logout = true;
        return ok(null);
      }),
      http.get(`${API}/auth/me`, () => ok(carlos)),
    );
    const { router } = renderRuta(URL_INVITACION, { usuario: usuarioDemo() });
    expect(
      await screen.findByText(/Tienes la sesión iniciada como propietario@petcat.test/),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Contraseña actual"), "Petcat123!");
    await user.click(screen.getByRole("button", { name: "Aceptar y entrar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/agenda"));
    expect(logout).toBe(true);
    expect(useAuth.getState().usuario?.email).toBe("carlos@petcat.test");
  });
});

describe("A4 · Invitación no utilizable", () => {
  it("409: muestra el mensaje de la API y sugiere pedir otra", async () => {
    servidor.use(
      http.get(`${API}/invitaciones/:token`, () =>
        fallo(409, "La invitación venció o fue reemplazada por una más reciente: pide que te la reenvíen"),
      ),
    );
    renderRuta(URL_INVITACION);
    expect(
      await screen.findByRole("heading", { name: "Esta invitación ya no se puede usar" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/venció o fue reemplazada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a iniciar sesión" })).toHaveAttribute("href", "/login");
  });

  it("404 o un token con formato inválido: no encontrada", async () => {
    servidor.use(http.get(`${API}/invitaciones/:token`, () => fallo(404, "Invitación no encontrada")));
    renderRuta(URL_INVITACION);
    expect(await screen.findByRole("heading", { name: "Invitación no encontrada" })).toBeInTheDocument();

    renderRuta("/invitacion/abc");
    expect(await screen.findAllByRole("heading", { name: "Invitación no encontrada" })).not.toHaveLength(0);
  });
});
