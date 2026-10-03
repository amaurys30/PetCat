import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const usuario = usuarioDemo({
  nombre: "Valentina",
  apellido: "Torres",
  telefono: "3009876543",
  politica: { version: "1.0", url: "https://petcat.co/politica" },
  politica_aceptada: { version: "1.0", fecha: "2026-02-03 10:00:00", canal: "panel_web" },
  negocios: [
    negocioDemo(),
    negocioDemo({
      id_negocio: 4,
      nombre: "Salud Animal 24h",
      relacion: "empleado",
      rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"] } },
      plan: { id_plan: 2, nombre: "Pro", en_prueba: false },
    }),
  ],
});

const suscripcion = http.get(`${API}/negocios/1/suscripcion`, () =>
  ok({ plan: {}, suscripcion: null, prueba_disponible: true, uso: { citas_mes: { usadas: 2, maximo: 30 } } }),
);

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E6 · Mi perfil", () => {
  it("se abre desde el menú del avatar y muestra negocios y privacidad", async () => {
    servidor.use(suscripcion);
    const { router } = renderRuta("/n/1/dashboard", { usuario });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));
    await user.click(await screen.findByRole("menuitem", { name: "Mi perfil" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/mi-perfil"));

    expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toHaveAttribute("readonly");
    expect(screen.getByText("Salud Animal 24h")).toBeInTheDocument();
    expect(screen.getByText("Veterinario")).toBeInTheDocument();
    expect(screen.getByText("Aceptada · versión 1.0 · 3 feb 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver política de tratamiento de datos/ })).toHaveAttribute(
      "href",
      "https://petcat.co/politica",
    );
  });

  it("guarda solo los datos que cambiaron y recarga el perfil", async () => {
    let cuerpo: unknown;
    servidor.use(
      suscripcion,
      http.patch(`${API}/auth/me`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({});
      }),
      http.get(`${API}/auth/me`, () => ok({ ...usuario, telefono: null })),
    );
    renderRuta("/n/1/mi-perfil", { usuario });
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Teléfono"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(cuerpo).toEqual({ telefono: null }));
  });

  it("las notificaciones se guardan al instante", async () => {
    let cuerpo: unknown;
    servidor.use(
      suscripcion,
      http.patch(`${API}/auth/me`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({});
      }),
      http.get(`${API}/auth/me`, () => ok(usuario)),
    );
    renderRuta("/n/1/mi-perfil", { usuario });
    await userEvent.setup().click(screen.getByRole("switch", { name: "Correo electrónico" }));
    await waitFor(() => expect(cuerpo).toEqual({ notif_email: false }));
  });

  it("cambio de contraseña: valida en el cliente y muestra el 422 en la actual", async () => {
    servidor.use(
      suscripcion,
      http.post(`${API}/auth/change-password`, () =>
        fallo(422, "La contraseña actual no es correcta", { password_actual: "Contraseña incorrecta" }),
      ),
    );
    renderRuta("/n/1/mi-perfil", { usuario });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Contraseña actual"), "Clave1234");
    await user.type(screen.getByLabelText("Nueva contraseña"), "Clave1234");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "Otra1234");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(await screen.findByText("Debe ser distinta de la actual")).toBeInTheDocument();
    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nueva contraseña"));
    await user.type(screen.getByLabelText("Nueva contraseña"), "Nueva5678");
    await user.clear(screen.getByLabelText("Confirmar nueva contraseña"));
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "Nueva5678");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(await screen.findByText("Contraseña incorrecta")).toBeInTheDocument();
  });

  it("sin verificar el correo ofrece reenviar el enlace", () => {
    servidor.use(suscripcion);
    renderRuta("/n/1/mi-perfil", { usuario: { ...usuario, email_verificado: false } });
    expect(screen.getByRole("button", { name: "Reenviar enlace" })).toBeInTheDocument();
  });
});
