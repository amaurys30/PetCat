import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const TOKEN = "a".repeat(64);
const suscripcion = http.get(`${API}/negocios/:id/suscripcion`, () =>
  ok({
    plan: {},
    suscripcion: null,
    prueba_disponible: true,
    uso: { citas_mes: { usadas: 18, maximo: 30 } },
  }),
);

beforeEach(() => __reiniciarSesionParaPruebas());

describe("A1 · Iniciar sesión", () => {
  const llenar = async (email: string, password: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Correo electrónico"), email);
    await user.type(screen.getByLabelText("Contraseña"), password);
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    return user;
  };

  it("valida los campos antes de llamar a la API", async () => {
    renderRuta("/login");
    await userEvent.setup().click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Escribe tu correo")).toBeInTheDocument();
    expect(screen.getByText("Escribe tu contraseña")).toBeInTheDocument();
  });

  it("muestra el mensaje de la API con credenciales inválidas", async () => {
    servidor.use(http.post(`${API}/auth/login`, () => fallo(401, "Credenciales inválidas")));
    renderRuta("/login");
    await llenar("propietario@petcat.test", "mala123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas");
  });

  it("con la cuenta bloqueada ofrece restablecer la contraseña", async () => {
    servidor.use(
      http.post(`${API}/auth/login`, () =>
        fallo(403, "Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en 15 minutos"),
      ),
    );
    renderRuta("/login");
    await llenar("propietario@petcat.test", "mala123");
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Cuenta bloqueada");
    expect(screen.getByRole("link", { name: "Restablecer contraseña" })).toHaveAttribute(
      "href",
      "/recuperar-password",
    );
  });

  it("con un solo negocio entra directo al panel", async () => {
    servidor.use(
      http.post(`${API}/auth/login`, () => ok({ access_token: "a", refresh_token: "r", usuario: {} })),
      http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
      suscripcion,
    );
    const { router } = renderRuta("/login");
    await llenar("propietario@petcat.test", "Petcat123!");
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/dashboard"));
    expect(await screen.findByText("18 de 30 citas este mes")).toBeInTheDocument();
  });

  it("con varios negocios va al selector (A5)", async () => {
    const usuario = usuarioDemo({
      nombre: "Valentina",
      negocios: [
        negocioDemo({
          id_negocio: 4,
          nombre: "Centro Veterinario Salud Animal 24h",
          relacion: "empleado",
          rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"] } },
          plan: { id_plan: 2, nombre: "Pro", en_prueba: true },
        }),
        negocioDemo({
          id_negocio: 2,
          nombre: "Peluquería Canina Huellitas",
          relacion: "empleado",
          rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { citas: ["ver"] } },
        }),
      ],
    });
    servidor.use(
      http.post(`${API}/auth/login`, () => ok({ access_token: "a", refresh_token: "r", usuario: {} })),
      http.get(`${API}/auth/me`, () => ok(usuario)),
    );
    const { router } = renderRuta("/login");
    await llenar("vet.salud@petcat.test", "Petcat123!");
    await waitFor(() => expect(router.state.location.pathname).toBe("/negocios"));
    expect(
      await screen.findByText("Tienes acceso a 2 negocios. Elige con cuál quieres trabajar."),
    ).toBeInTheDocument();
    expect(screen.getByText("Pro · prueba")).toBeInTheDocument();
    expect(screen.getByText("Empleado · Rol: Recepcionista")).toBeInTheDocument();
  });

  it("si la sesión expiró lo dice", () => {
    renderRuta("/login?sesion=expirada");
    expect(screen.getByText(/Tu sesión expiró/)).toBeInTheDocument();
  });
});

describe("A5 · sin negocios", () => {
  it("ofrece crear el negocio y explica la invitación", () => {
    renderRuta("/negocios", { usuario: usuarioDemo({ negocios: [] }) });
    expect(screen.getByRole("link", { name: "Crear mi negocio" })).toHaveAttribute("href", "/negocios/nuevo");
    expect(screen.getByText(/Revisa tu correo y abre el enlace de la invitación/)).toBeInTheDocument();
  });
});

describe("A3 · Crear / restablecer contraseña", () => {
  it("marca las reglas a medida que se escribe y exige que coincidan", async () => {
    renderRuta(`/restablecer-password/${TOKEN}`);
    expect(screen.getByRole("heading", { name: "Restablece tu contraseña" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "abcdefgh");
    expect(screen.getByText("Entre 8 y 72 caracteres").parentElement).toHaveTextContent("(cumple)");
    expect(screen.getByText("Al menos una letra y un número").parentElement).toHaveTextContent("(falta)");

    await user.type(screen.getByLabelText("Confirmar contraseña"), "otra");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("Debe incluir al menos un número")).toBeInTheDocument();
    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
  });

  it("al guardar va al login con el aviso", async () => {
    servidor.use(http.post(`${API}/auth/reset-password`, () => ok(null)));
    const { router } = renderRuta(`/crear-password/${TOKEN}`);
    expect(screen.getByRole("heading", { name: "Crea tu contraseña" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "Petcat123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Petcat123");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(
      await screen.findByText("Listo, tu cuenta quedó activa. Ya puedes iniciar sesión."),
    ).toBeInTheDocument();
  });

  it("con el enlace vencido ofrece pedir otro", async () => {
    servidor.use(
      http.post(`${API}/auth/reset-password`, () =>
        fallo(400, "El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo"),
      ),
    );
    renderRuta(`/restablecer-password/${TOKEN}`);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "Petcat123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Petcat123");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ya venció");
    expect(screen.getByRole("link", { name: "Solicitar un enlace nuevo" })).toBeInTheDocument();
  });
});

describe("A9 · Política de datos", () => {
  it("bloquea hasta aceptar y luego desaparece", async () => {
    const pendiente = usuarioDemo({
      requiere_aceptar_politica: true,
      politica: { version: "1.1", url: "https://petcat.co/p" },
    });
    let aceptada = false;
    servidor.use(
      suscripcion,
      http.post(`${API}/auth/politica-datos/aceptar`, () => {
        aceptada = true;
        return ok({});
      }),
      http.get(`${API}/auth/me`, () => ok({ ...pendiente, requiere_aceptar_politica: !aceptada })),
    );
    renderRuta("/n/1/dashboard", { usuario: pendiente });

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("versión 1.1");
    expect(screen.getByRole("link", { name: /Leer la política completa/ })).toHaveAttribute(
      "href",
      "https://petcat.co/p",
    );
    const boton = screen.getByRole("button", { name: "Aceptar y continuar" });
    expect(boton).toBeDisabled();

    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByLabelText("He leído y acepto la política de tratamiento de datos."));
    await user.click(boton);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(aceptada).toBe(true);
  });
});

describe("Panel", () => {
  it("el menú muestra solo lo que permite el rol y una sección ajena dice sin permiso", async () => {
    const veterinario = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"], clientes: ["ver"] } },
        }),
      ],
    });
    const { router } = renderRuta("/n/1", { usuario: veterinario });
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/agenda"));
    const menu = screen.getByRole("navigation", { name: "Secciones del negocio" });
    expect(menu).toHaveTextContent("Agenda");
    expect(menu).toHaveTextContent("Clientes");
    expect(menu).not.toHaveTextContent("Dashboard");
    expect(menu).not.toHaveTextContent("Configuración");

    await router.navigate("/n/1/equipo");
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
  });

  it("un negocio al que no tiene acceso muestra no encontrado", async () => {
    renderRuta("/n/99/dashboard", { usuario: usuarioDemo() });
    expect(await screen.findByText("Este negocio no existe o no tienes acceso a él.")).toBeInTheDocument();
  });
});
