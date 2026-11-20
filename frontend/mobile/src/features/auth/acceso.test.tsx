import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { http, HttpResponse } from "msw";
import { AccessibilityInfo } from "react-native";

import { refreshStorage } from "@/api/refreshStorage";
import { queryClient } from "@/lib/queryClient";
import { useSesion } from "@/store/sesion";

import { reiniciarSesion, renderApp } from "../../../test/app";
import { API, fallo, ok, perfilDemo, sesionDemo, usuarioDemo } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { MENSAJE_CREDENCIALES } from "./LoginScreen";

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

let anuncios: string[];

beforeEach(async () => {
  await reiniciarSesion();
  anuncios = [];
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((m) => void anuncios.push(m));
});

afterEach(() => jest.restoreAllMocks());

/** Login correcto: guarda el cuerpo enviado para revisarlo. */
function loginCorrecto(cuerpos: unknown[] = [], usuario = usuarioDemo) {
  return [
    http.post(`${API}/auth/login`, async ({ request }) => {
      cuerpos.push(await request.json());
      return ok(sesionDemo(1, usuario), "Sesión iniciada");
    }),
    http.get(`${API}/auth/me`, () => ok(perfilDemo(false, usuario))),
  ];
}

async function escribir(etiqueta: string | RegExp, texto: string) {
  await fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
}

describe("M3 · Iniciar sesión", () => {
  it("entra con el dispositivo del teléfono y abre las pestañas", async () => {
    const cuerpos: unknown[] = [];
    server.use(...loginCorrecto(cuerpos));
    await renderApp("/login");

    await escribir("Correo electrónico", "  Sofia@PetCat.test ");
    await escribir("Contraseña", "Clave1234");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeSelected();
    expect(cuerpos[0]).toMatchObject({ email: "sofia@petcat.test", password: "Clave1234" });
    expect(typeof (cuerpos[0] as { dispositivo: unknown }).dispositivo).toBe("string");
    expect(await refreshStorage.leer()).toBe("refresh-1");
  });

  it("campos vacíos: errores por campo, anunciados, sin llamar a la API", async () => {
    let llamadas = 0;
    server.use(http.post(`${API}/auth/login`, () => (llamadas++, ok(sesionDemo()))));
    await renderApp("/login");

    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByLabelText("Correo electrónico. Error: Escribe tu correo")).toBeOnTheScreen();
    expect(screen.getByLabelText("Contraseña. Error: Escribe tu contraseña")).toBeOnTheScreen();
    expect(anuncios).toContain("Revisa 2 campos del formulario");
    expect(llamadas).toBe(0);
  });

  it("401: mensaje propio, claro, y anunciado", async () => {
    server.use(http.post(`${API}/auth/login`, () => fallo(401, "Credenciales inválidas")));
    await renderApp("/login");
    await escribir("Correo electrónico", "sofia@petcat.test");
    await escribir("Contraseña", "mala");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_CREDENCIALES);
    expect(anuncios).toContain(MENSAJE_CREDENCIALES);
    expect(screen.queryByText("Credenciales inválidas")).toBeNull();
  });

  it("403 por cuenta bloqueada: el mensaje de la API y el atajo a recuperar con el correo", async () => {
    const bloqueada = "Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en 15 minutos";
    server.use(http.post(`${API}/auth/login`, () => fallo(403, bloqueada)));
    await renderApp("/login");
    await escribir("Correo electrónico", "sofia@petcat.test");
    await escribir("Contraseña", "Clave1234");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText(bloqueada)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("link", { name: "Restablecer mi contraseña" }));
    expect(screen).toHavePathname("/recuperar");
    expect(screen.getByLabelText("Correo electrónico")).toHaveDisplayValue("sofia@petcat.test");
  });

  it("403 por cuenta desactivada: sin atajo a recuperar (no enviaría nada)", async () => {
    server.use(http.post(`${API}/auth/login`, () => fallo(403, "La cuenta está desactivada")));
    await renderApp("/login");
    await escribir("Correo electrónico", "sofia@petcat.test");
    await escribir("Contraseña", "Clave1234");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("La cuenta está desactivada")).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: "Restablecer mi contraseña" })).toBeNull();
  });

  it("429 y sin red: el mensaje que corresponde", async () => {
    const limite = "Demasiados intentos, espera 15 minutos antes de volver a intentarlo";
    server.use(http.post(`${API}/auth/login`, () => fallo(429, limite)));
    await renderApp("/login");
    await escribir("Correo electrónico", "sofia@petcat.test");
    await escribir("Contraseña", "Clave1234");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(limite)).toBeOnTheScreen();

    server.use(http.post(`${API}/auth/login`, () => HttpResponse.error()));
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
    expect(
      await screen.findByText("Sin conexión. Revisa tu internet e inténtalo de nuevo."),
    ).toBeOnTheScreen();
  });

  it("sin sesión ni historial, abrir /login deja la Bienvenida debajo", async () => {
    await renderApp("/login");
    await screen.findByRole("header", { name: "¡Hola de nuevo!" });
    await fireEvent.press(screen.getByRole("link", { name: "Crea tu cuenta" }));
    expect(screen).toHavePathname("/registro");
  });
});

describe("M2 · Crear cuenta", () => {
  async function llenar({ email = "laura@correo.com", password = "Clave1234", acepta = true } = {}) {
    await escribir("Nombre", "Laura");
    await escribir("Apellido", "Gómez");
    await escribir("Correo electrónico", email);
    await escribir("Contraseña", password);
    if (acepta) await fireEvent.press(screen.getByRole("checkbox"));
  }

  it("valida como la API antes de enviar, y la casilla es obligatoria", async () => {
    let llamadas = 0;
    server.use(http.post(`${API}/auth/register`, () => (llamadas++, ok(usuarioDemo))));
    await renderApp("/registro");

    await escribir("Nombre", "L");
    await escribir("Correo electrónico", "laura@");
    await escribir("Contraseña", "solotexto");
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByLabelText("Nombre. Error: Escribe tu nombre (mínimo 2 letras)"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/Correo electrónico\. Error: Escribe un correo válido/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Contraseña. Error: Incluye al menos un número")).toBeOnTheScreen();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Para crear tu cuenta debes aceptar la política de datos")).toBeOnTheScreen();
    expect(llamadas).toBe(0);
  });

  it("muestra la seguridad de la contraseña en texto", async () => {
    await renderApp("/registro");
    await escribir("Contraseña", "Clave1234");
    expect(screen.getByLabelText("Seguridad de la contraseña: Buena")).toBeOnTheScreen();
  });

  it("crea la cuenta (canal app), entra con el dispositivo y pide confirmar el correo", async () => {
    const registro: unknown[] = [];
    const login: unknown[] = [];
    const nuevo = { ...usuarioDemo, nombre: "Laura", email: "laura@correo.com", email_verificado: false };
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        registro.push(await request.json());
        return HttpResponse.json({ success: true, message: "Cuenta creada", data: nuevo }, { status: 201 });
      }),
      ...loginCorrecto(login, nuevo),
    );
    await renderApp("/registro");
    await llenar();
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("header", { name: "Confirma tu correo" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/verificar-correo");
    expect(registro[0]).toEqual({
      nombre: "Laura",
      apellido: "Gómez",
      email: "laura@correo.com",
      password: "Clave1234",
      acepta_politica_datos: true,
      tipo_usuario: "cliente",
      canal: "app",
    });
    expect(login[0]).toMatchObject({ email: "laura@correo.com", password: "Clave1234" });
  });

  it("409: el mensaje de la API y el atajo para activar la cuenta con ese correo", async () => {
    const existe =
      'Ya existe una cuenta con ese correo. Si no recuerdas la contraseña o un negocio te registró, usa "Olvidé mi contraseña" para activarla';
    server.use(http.post(`${API}/auth/register`, () => fallo(409, existe, { email: "Ya está registrado" })));
    await renderApp("/registro");
    await llenar();
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(existe);
    await fireEvent.press(screen.getByRole("link", { name: "Activar mi cuenta con este correo" }));
    expect(screen).toHavePathname("/recuperar");
    expect(screen.getByLabelText("Correo electrónico")).toHaveDisplayValue("laura@correo.com");
  });

  it("422: los errores de la API van a su campo", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        fallo(422, "Datos inválidos", { email: "Correo electrónico inválido" }),
      ),
    );
    await renderApp("/registro");
    await llenar();
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(
      await screen.findByLabelText("Correo electrónico. Error: Correo electrónico inválido"),
    ).toBeOnTheScreen();
  });

  it("si el login después del registro falla, lleva al login con el aviso y el correo", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json({ success: true, message: "Cuenta creada", data: usuarioDemo }, { status: 201 }),
      ),
      http.post(`${API}/auth/login`, () => HttpResponse.error()),
    );
    await renderApp("/registro");
    await llenar();
    await fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Tu cuenta está creada. Inicia sesión para entrar.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Correo electrónico")).toHaveDisplayValue("laura@correo.com");
  });
});

describe("Recuperar la contraseña (y activar la cuenta que creó la veterinaria)", () => {
  it("correo → código y contraseña nueva → entra solo", async () => {
    const cuerpos: unknown[] = [];
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        ok(
          null,
          "Si el correo está registrado, te enviamos un código y un enlace para restablecer la contraseña",
        ),
      ),
      http.post(`${API}/auth/reset-password/codigo`, async ({ request }) => {
        cuerpos.push(await request.json());
        return ok(null, "Contraseña restablecida. Ya puedes iniciar sesión");
      }),
      ...loginCorrecto(),
    );
    await renderApp("/recuperar");

    await escribir("Correo electrónico", "sofia@petcat.test");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByRole("header", { name: "Escribe el código" })).toBeOnTheScreen();

    await escribir("Código del correo", "48 29-13");
    await escribir("Contraseña nueva", "OtraClave987");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar y entrar" }));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
    expect(cuerpos[0]).toEqual({ email: "sofia@petcat.test", codigo: "482913", password: "OtraClave987" });
  });

  it("código inválido: el error va al campo del código y se anuncia", async () => {
    const invalido = "El código no es válido o ya venció. Solicita uno nuevo";
    server.use(http.post(`${API}/auth/reset-password/codigo`, () => fallo(400, invalido)));
    await renderApp("/recuperar-codigo?email=sofia%40petcat.test");

    await escribir("Código del correo", "000000");
    await escribir("Contraseña nueva", "OtraClave987");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar y entrar" }));

    expect(await screen.findByLabelText(`Código del correo. Error: ${invalido}`)).toBeOnTheScreen();
    expect(anuncios).toContain(invalido);
  });

  it("sin correo en la ruta, vuelve al paso del correo", async () => {
    await renderApp("/recuperar-codigo");
    expect(await screen.findByRole("header", { name: "Recupera tu contraseña" })).toBeOnTheScreen();
  });
});

describe("Confirmar el correo", () => {
  async function conSesionSinVerificar() {
    const usuario = { ...usuarioDemo, email_verificado: false };
    await refreshStorage.guardar("refresh-0");
    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1, usuario))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo(false, usuario))),
    );
  }

  it("con el código correcto confirma y vuelve a las pestañas", async () => {
    await conSesionSinVerificar();
    server.use(http.post(`${API}/auth/verify-email/codigo`, () => ok(null, "Correo verificado")));
    await renderApp("/verificar-correo");

    await escribir("Código del correo", "123456");
    await fireEvent.press(await screen.findByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
    expect(useSesion.getState().usuario?.email_verificado).toBe(true);
    expect(anuncios).toContain("Correo confirmado");
  });

  it("reenviar: el mensaje de la API, también el 429; Hacerlo después vuelve al inicio", async () => {
    await conSesionSinVerificar();
    server.use(
      http.post(`${API}/auth/resend-verification`, () =>
        fallo(429, "Ya te enviamos un correo hace menos de un minuto. Espera un momento"),
      ),
    );
    await renderApp("/verificar-correo");

    await fireEvent.press(await screen.findByRole("button", { name: "Reenviar código" }));
    expect(
      await screen.findByText("Ya te enviamos un correo hace menos de un minuto. Espera un momento"),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Hacerlo después" }));
    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
  });

  it("Perfil avisa del correo sin confirmar y lleva a confirmarlo", async () => {
    await conSesionSinVerificar();
    await renderApp("/perfil");
    await fireEvent.press(await screen.findByRole("link", { name: "Confirmar ahora" }));
    expect(screen).toHavePathname("/verificar-correo");
  });
});

describe("Cerrar sesión", () => {
  async function abrirPerfil() {
    await refreshStorage.guardar("refresh-0");
    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    );
    await renderApp("/perfil");
    await screen.findByText("sofia@petcat.test");
    queryClient.setQueryData(["mascotas"], [{ id: 1 }]);
  }

  it("avisa a la API y borra tokens, sesión y caché", async () => {
    let logout = 0;
    server.use(http.post(`${API}/auth/logout`, () => (logout++, ok(null, "Sesión cerrada"))));
    await abrirPerfil();

    await fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
    expect(logout).toBe(1);
    expect(await refreshStorage.leer()).toBeNull();
    expect(useSesion.getState()).toMatchObject({ estado: "anonima", accessToken: null, usuario: null });
    expect(queryClient.getQueryData(["mascotas"])).toBeUndefined();
  });

  it("sin red también cierra la sesión del teléfono", async () => {
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    await abrirPerfil();
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
    expect(await refreshStorage.leer()).toBeNull();
  });
});

describe("Política de datos", () => {
  it("sin URL publicada: resumen dentro de la app con aviso de versión provisional", async () => {
    await renderApp("/registro");
    await fireEvent.press(screen.getByRole("link", { name: "Ver política" }));
    expect(await screen.findByText(/^Versión provisional 1\.0/)).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Tus derechos (Ley 1581 de 2012)" })).toBeOnTheScreen();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("con URL publicada: abre el texto completo en el navegador", async () => {
    server.use(
      http.get(`${API}/politica-datos`, () => ok({ version: "2.0", url: "https://petcat.co/politica" })),
    );
    await renderApp("/registro");
    await waitFor(() => expect(queryClient.getQueryData(["politica-datos"])).toBeTruthy());
    // TanStack avisa a la pantalla con un setTimeout(0), que aquí es un timer falso.
    await act(() => jest.advanceTimersByTimeAsync(0));
    await fireEvent.press(screen.getByRole("link", { name: "Ver política" }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://petcat.co/politica");
  });
});
