import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const TOKEN = "b".repeat(64);
const nuevo = usuarioDemo({
  nombre: "Valentina",
  email: "valentina@patitas.co",
  email_verificado: false,
  negocios: [],
});

beforeEach(() => __reiniciarSesionParaPruebas());

describe("A7 · Crear cuenta", () => {
  const llenar = async (cambios: { telefono?: string } = {}) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre *"), "Valentina");
    await user.type(screen.getByLabelText("Apellido *"), "Torres");
    await user.type(screen.getByLabelText("Correo electrónico *"), "valentina@patitas.co");
    if (cambios.telefono) await user.type(screen.getByLabelText("Teléfono"), cambios.telefono);
    await user.type(screen.getByLabelText("Contraseña *"), "Patitas123");
    await user.click(screen.getByLabelText(/Acepto la política/));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    return user;
  };

  it("valida antes de llamar a la API, incluida la política", async () => {
    renderRuta("/registro");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Contraseña *"), "abcdefgh");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Escribe tu correo")).toBeInTheDocument();
    expect(screen.getAllByText("Debe tener al menos 2 caracteres")).toHaveLength(2);
    expect(screen.getByText("Debe incluir al menos un número")).toBeInTheDocument();
    expect(screen.getByText("Debes aceptar la política de tratamiento de datos")).toBeInTheDocument();
  });

  it("crea la cuenta como negocio desde el panel, entra y muestra la bienvenida", async () => {
    let cuerpo: unknown;
    servidor.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({}, 201);
      }),
      http.post(`${API}/auth/login`, () => ok({ access_token: "a", refresh_token: "r", usuario: {} })),
      http.get(`${API}/auth/me`, () => ok(nuevo)),
    );
    const { router } = renderRuta("/registro");
    await llenar();

    await waitFor(() => expect(router.state.location.pathname).toBe("/negocios"));
    expect(cuerpo).toEqual({
      nombre: "Valentina",
      apellido: "Torres",
      email: "valentina@patitas.co",
      password: "Patitas123",
      acepta_politica_datos: true,
      tipo_usuario: "negocio",
      canal: "panel_web",
    });
    expect(await screen.findByText(/te enviamos un enlace a/)).toHaveTextContent("valentina@patitas.co");
    expect(screen.getByRole("link", { name: /Crear mi negocio/ })).toHaveAttribute("href", "/negocios/nuevo");
  });

  it("envía el teléfono solo si lo escribió", async () => {
    let cuerpo: Record<string, unknown> = {};
    servidor.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>;
        return ok({}, 201);
      }),
      http.post(`${API}/auth/login`, () => ok({ access_token: "a", refresh_token: "r", usuario: {} })),
      http.get(`${API}/auth/me`, () => ok(nuevo)),
    );
    renderRuta("/registro");
    await llenar({ telefono: "300 987 6543" });
    await waitFor(() => expect(cuerpo.telefono).toBe("300 987 6543"));
  });

  it("correo ya registrado: muestra el mensaje y enlaza a recuperar con el correo", async () => {
    servidor.use(
      http.post(`${API}/auth/register`, () =>
        fallo(
          409,
          'Ya existe una cuenta con ese correo. Si no recuerdas la contraseña o un negocio te registró, usa "Olvidé mi contraseña" para activarla',
          { email: "Ya está registrado" },
        ),
      ),
    );
    renderRuta("/registro");
    await llenar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese correo");
    expect(screen.getByRole("link", { name: "Olvidé mi contraseña" })).toHaveAttribute(
      "href",
      "/recuperar-password?email=valentina%40patitas.co",
    );
  });

  it("los errores 422 de la API van a su campo", async () => {
    servidor.use(
      http.post(`${API}/auth/register`, () =>
        fallo(422, "Datos inválidos", { telefono: "Teléfono inválido" }),
      ),
    );
    renderRuta("/registro");
    await llenar({ telefono: "3001234567" });
    expect(await screen.findByText("Teléfono inválido")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("enlaza la política vigente si PetCat publicó la URL", async () => {
    servidor.use(http.get(`${API}/politica-datos`, () => ok({ version: "1.1", url: "https://petcat.co/p" })));
    renderRuta("/registro");
    expect(await screen.findByRole("link", { name: "Leer la política (versión 1.1)" })).toHaveAttribute(
      "href",
      "https://petcat.co/p",
    );
  });
});

describe("A2 · Recuperar contraseña con el correo en la URL", () => {
  it("lo precarga", () => {
    renderRuta("/recuperar-password?email=valentina%40patitas.co");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("valentina@patitas.co");
  });
});

describe("Bienvenida (A5 sin negocios)", () => {
  it("reenvía el enlace de verificación y espera un minuto antes de permitir otro", async () => {
    servidor.use(http.post(`${API}/auth/resend-verification`, () => ok({ email: nuevo.email })));
    renderRuta("/negocios", { usuario: nuevo });
    await userEvent.setup().click(screen.getByRole("button", { name: "Reenviar enlace" }));
    expect(await screen.findByText(/Te enviamos un enlace nuevo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar en \d+ s/ })).toBeDisabled();
  });

  it("si el correo ya estaba verificado (409), recarga el perfil y el aviso desaparece", async () => {
    servidor.use(
      http.post(`${API}/auth/resend-verification`, () => fallo(409, "Tu correo ya está verificado")),
      http.get(`${API}/auth/me`, () => ok({ ...nuevo, email_verificado: true })),
    );
    renderRuta("/negocios", { usuario: nuevo });
    await userEvent.setup().click(screen.getByRole("button", { name: "Reenviar enlace" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Reenviar enlace" })).not.toBeInTheDocument(),
    );
  });

  it("con la cuenta verificada no muestra el aviso", () => {
    renderRuta("/negocios", { usuario: { ...nuevo, email_verificado: true } });
    expect(screen.queryByText(/Confirma tu correo/)).not.toBeInTheDocument();
  });

  it("'Ya la acepté' recarga los negocios: sin ninguno lo explica; con la invitación aceptada muestra la lista", async () => {
    let negocios: ReturnType<typeof negocioDemo>[] = [];
    servidor.use(http.get(`${API}/auth/me`, () => ok({ ...nuevo, negocios })));
    renderRuta("/negocios", { usuario: nuevo });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Ya la acepté, actualizar" }));
    expect(await screen.findByText(/Todavía no tienes acceso a ningún negocio/)).toBeInTheDocument();

    negocios = [
      negocioDemo({ relacion: "empleado", rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: {} } }),
    ];
    await user.click(screen.getByRole("button", { name: "Ya la acepté, actualizar" }));
    expect(await screen.findByText("Empleado · Rol: Recepcionista")).toBeInTheDocument();
  });
});

describe("A8 · Verificación de correo", () => {
  it("con sesión: verifica una sola vez, actualiza el perfil y lleva al panel", async () => {
    let llamadas = 0;
    servidor.use(
      http.get(`${API}/auth/verify-email/:token`, () => {
        llamadas += 1;
        return ok(null);
      }),
      http.get(`${API}/auth/me`, () => ok({ ...nuevo, email_verificado: true })),
    );
    renderRuta(`/verificar-email/${TOKEN}`, { usuario: nuevo });
    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeInTheDocument();
    expect(screen.getByText(/valentina@patitas.co quedó confirmado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/");
    expect(llamadas).toBe(1);
  });

  it("sin sesión: al verificar ofrece iniciar sesión", async () => {
    servidor.use(http.get(`${API}/auth/verify-email/:token`, () => ok(null)));
    renderRuta(`/verificar-email/${TOKEN}`);
    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
  });

  const vencido = http.get(`${API}/auth/verify-email/:token`, () =>
    fallo(400, "El enlace de verificación no es válido o ya venció"),
  );

  it("enlace vencido con sesión y correo sin verificar: envía uno nuevo", async () => {
    servidor.use(
      vencido,
      http.get(`${API}/auth/me`, () => ok(nuevo)),
      http.post(`${API}/auth/resend-verification`, () => ok({ email: nuevo.email })),
    );
    renderRuta(`/verificar-email/${TOKEN}`, { usuario: nuevo });
    expect(await screen.findByText(/vencen a las 24 horas/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Enviarme un enlace nuevo" }));
    expect(await screen.findByText(/Te enviamos un enlace nuevo a valentina@patitas.co/)).toBeInTheDocument();
  });

  it("enlace ya usado con el correo verificado: lo dice", async () => {
    const verificado = { ...nuevo, email_verificado: true };
    servidor.use(
      vencido,
      http.get(`${API}/auth/me`, () => ok(verificado)),
    );
    renderRuta(`/verificar-email/${TOKEN}`, { usuario: verificado });
    expect(await screen.findByRole("heading", { name: "Tu correo ya está verificado" })).toBeInTheDocument();
  });

  it("enlace vencido sin sesión: pide el correo y responde de forma neutra", async () => {
    let pedido: unknown;
    servidor.use(
      vencido,
      http.post(`${API}/auth/request-verification`, async ({ request }) => {
        pedido = await request.json();
        return ok(null);
      }),
    );
    renderRuta(`/verificar-email/${TOKEN}`);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo electrónico"), "valentina@patitas.co");
    await user.click(screen.getByRole("button", { name: "Enviarme un enlace nuevo" }));
    expect(await screen.findByText(/Si el correo está registrado y sin verificar/)).toBeInTheDocument();
    expect(pedido).toEqual({ email: "valentina@patitas.co" });
  });

  it("un token con formato inválido no llama a la API", async () => {
    let llamadas = 0;
    servidor.use(
      http.get(`${API}/auth/verify-email/:token`, () => {
        llamadas += 1;
        return ok(null);
      }),
    );
    renderRuta("/verificar-email/no-es-un-token");
    expect(await screen.findByRole("heading", { name: "Enlace vencido o ya usado" })).toBeInTheDocument();
    expect(llamadas).toBe(0);
  });
});
